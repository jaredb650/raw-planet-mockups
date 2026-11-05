import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { GET, POST } from "@/app/unsubscribe/route";
import { renderEmail } from "@/emails/render";
import { campaignEmail, winBackEmail } from "@/emails/templates/campaign";
import { campaignStats, countRecipients, finishCampaigns, segmentRecipients, sendCampaignBatch, sendWinBacks, startCampaign, unsubscribeCustomer } from "@/lib/admin/campaigns";
import { setSetting } from "@/lib/automation/settings";
import { fulfillBooking } from "@/lib/booking/service";
import { getDb, type DB } from "@/lib/db";
import { bookingEvents, bookings, campaignRecipients, campaigns, customers, emailLog, experiences, settings } from "@/lib/db/schema";
import { unsubToken, unsubTokenValid, unsubUrl } from "@/lib/unsubscribe-token";

// Wraps the real sender so tests can read the headers, which email_log doesn't keep.
const sent = vi.hoisted(() => [] as { to: string; headers?: Record<string, string> }[]);
vi.mock("@/lib/email/send", async (actual) => {
  const real = await actual<typeof import("@/lib/email/send")>();
  return { sendEmail: (m: Parameters<typeof real.sendEmail>[0]) => (sent.push(m), real.sendEmail(m)) };
});

const dir = mkdtempSync(path.join(tmpdir(), "rp-campaigns-"));
const NOW = new Date("2026-11-04T15:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
let db: DB;
let seq = 0;
let expA: string;
let expB: string;

async function experience(slug: string) {
  const [e] = await db
    .insert(experiences)
    .values({ slug, name: slug, shortName: slug, theme: "production", resourceGroup: slug, durationOptions: [{ minutes: 120, priceCents: 10000 }], schedule: {} } as typeof experiences.$inferInsert)
    .returning({ id: experiences.id });
  return e.id;
}

async function guest(email: string, over: Partial<typeof customers.$inferInsert> = {}) {
  const [c] = await db.insert(customers).values({ email, name: "Test Guest", marketingOptIn: true, ...over }).returning();
  return c;
}

async function book(c: { id: string; email: string }, over: Partial<typeof bookings.$inferInsert> = {}) {
  const startAt = over.startAt ?? daysAgo(30);
  const [b] = await db
    .insert(bookings)
    .values({
      code: `RP-T${++seq}`,
      experienceId: expA,
      customerId: c.id,
      status: "completed",
      source: "direct",
      startAt,
      endAt: new Date(startAt.getTime() + 2 * 3_600_000),
      durationMinutes: 120,
      guests: 1,
      resourceGroup: "t",
      contactName: "Test Guest",
      contactEmail: c.email,
      manageToken: `tok${seq}`,
      ...over,
    } as typeof bookings.$inferInsert)
    .returning();
  return b;
}

const emails = async (seg = {}) => (await segmentRecipients(seg, NOW)).map((r) => r.email).sort();

async function campaign(segment = {}) {
  const [c] = await db.insert(campaigns).values({ name: "T", subject: "Hello", body: "Body" , segment }).returning();
  return c;
}

beforeAll(async () => {
  process.env.PGLITE_DIR = dir;
  db = await getDb();
  expA = await experience("exp-a");
  expB = await experience("exp-b");
}, 60_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

beforeEach(async () => {
  sent.length = 0;
  await db.delete(campaigns);
  await db.delete(emailLog);
  await db.delete(bookings);
  await db.delete(customers);
  await db.delete(settings);
  await setSetting("postalAddress", "1 Test St, New York, NY");
});

describe("who may be emailed", () => {
  test("every exclusion rule", async () => {
    await book(await guest("direct@x.com"));
    await guest("no-bookings@x.com");
    await book(await guest("no-optin@x.com", { marketingOptIn: false }));
    await book(await guest("gone@x.com", { unsubscribedAt: daysAgo(1) }));
    await book(await guest("relay@rawplanet.invalid"));
    await book(await guest("MIXED@FOO.INVALID"));
    await book(await guest("airbnb@x.com"), { source: "airbnb" });
    await book(await guest("viator@x.com"), { source: "viator" });
    const both = await guest("both-platforms@x.com");
    await book(both, { source: "airbnb" });
    await book(both, { source: "viator" });
    const mixed = await guest("also-direct@x.com");
    await book(mixed, { source: "airbnb" });
    await book(mixed, { source: "phone" });
    const abandoned = await guest("abandoned-direct@x.com");
    await book(abandoned, { source: "airbnb" });
    await book(abandoned, { status: "expired" });
    // Linked only by email: the platform booking still counts against them.
    await book({ ...(await guest("by-email@x.com")), id: null as unknown as string }, { source: "airbnb", customerId: null });

    expect(await emails()).toEqual(["also-direct@x.com", "direct@x.com", "no-bookings@x.com"]);
    expect(await countRecipients({}, NOW)).toBe(3);
  });

  test("segment filters", async () => {
    const vip = await guest("vip@x.com", { tags: ["vip"], language: "es" });
    await book(vip, { startAt: daysAgo(200), experienceId: expB });
    await book(vip, { startAt: daysAgo(150) });
    await book(await guest("recent@x.com", { tags: ["dj"] }), { startAt: daysAgo(10) });
    const returning = await guest("coming-back@x.com");
    await book(returning, { startAt: daysAgo(200) });
    await book(returning, { status: "confirmed", startAt: new Date(NOW.getTime() + 5 * 86_400_000) });
    await book(await guest("no-show@x.com"), { status: "no_show", startAt: daysAgo(200) });
    await guest("never-came@x.com");

    expect(await emails({ tags: ["vip", "dj"] })).toEqual(["recent@x.com", "vip@x.com"]);
    expect(await emails({ experienceIds: [expB] })).toEqual(["vip@x.com"]);
    expect(await emails({ lapsedDays: 120 })).toEqual(["vip@x.com"]);
    expect(await emails({ minSessions: 2 })).toEqual(["vip@x.com"]);
    expect(await emails({ language: "es" })).toEqual(["vip@x.com"]);
    expect(await emails({ tags: ["dj"], language: "es" })).toEqual([]);
  });

  test("a past confirmed booking counts as a session, an upcoming one doesn't", async () => {
    await book(await guest("unmarked@x.com"), { status: "confirmed", startAt: daysAgo(130) });
    await book(await guest("future@x.com"), { status: "confirmed", startAt: new Date(NOW.getTime() + 86_400_000) });
    expect(await emails({ minSessions: 1 })).toEqual(["unmarked@x.com"]);
  });
});

describe("unsubscribe", () => {
  test("token is bound to the customer and not to any other purpose", () => {
    const t = unsubToken("cust-1");
    expect(unsubTokenValid("cust-1", t)).toBe(true);
    expect(unsubTokenValid("cust-2", t)).toBe(false);
    expect(unsubTokenValid("cust-1", `${t.slice(0, -1)}x`)).toBe(false);
    expect(unsubTokenValid("cust-1", "")).toBe(false);
    expect(unsubTokenValid("", t)).toBe(false);
    const url = new URL(unsubUrl("cust-1", "es"));
    expect(url.pathname).toBe("/unsubscribe");
    expect(url.searchParams.get("t")).toBe(t);
    expect(url.searchParams.get("l")).toBe("es");
  });

  test("the route: GET only asks, a one-click POST unsubscribes, a bad token does nothing", async () => {
    const c = await guest("a@x.com");
    const url = unsubUrl(c.id, "es");
    const optedOut = async () => (await db.select().from(customers).where(eq(customers.id, c.id)))[0].unsubscribedAt !== null;

    const page = await GET(new Request(url));
    expect(await page.text()).toContain("Darme de baja");
    expect(await optedOut()).toBe(false);

    const forged = await POST(new Request(url.replace(/t=[^&]+/, "t=forged"), { method: "POST" }));
    expect(forged.status).toBe(400);
    expect(await optedOut()).toBe(false);

    const oneClick = await POST(new Request(url, { method: "POST", body: "List-Unsubscribe=One-Click", headers: { "content-type": "application/x-www-form-urlencoded" } }));
    expect(oneClick.status).toBe(200);
    expect(await oneClick.text()).toContain("Te has dado de baja");
    expect(await optedOut()).toBe(true);
  });

  test("an unsubscribed guest is never selected, even after a later paid checkout ticks the box", async () => {
    const c = await guest("leaver@x.com");
    await book(c);
    expect(await emails()).toEqual(["leaver@x.com"]);
    await unsubscribeCustomer(c.id);
    expect(await emails()).toEqual([]);

    const b = await book(c, { status: "pending_payment", startAt: new Date(NOW.getTime() + 864_000_000) });
    await db.insert(bookingEvents).values({ bookingId: b.id, type: "marketing_opt_in", message: "ticked" });
    await fulfillBooking(b.id, { amountPaidCents: 0 });

    const [after] = await db.select().from(customers).where(eq(customers.id, c.id));
    expect(after.unsubscribedAt).not.toBeNull();
    expect(after.marketingOptIn).toBe(false);
    expect(await emails()).toEqual([]);
  });

  test("the checkout tick opts in a returning guest once the booking is paid", async () => {
    const c = await guest("returning@x.com", { marketingOptIn: false });
    const b = await book(c, { status: "pending_payment", startAt: new Date(NOW.getTime() + 864_000_000) });
    await db.insert(bookingEvents).values({ bookingId: b.id, type: "marketing_opt_in", message: "ticked" });
    await fulfillBooking(b.id, { amountPaidCents: 0 });
    expect((await db.select().from(customers).where(eq(customers.id, c.id)))[0].marketingOptIn).toBe(true);
  });

  test("marketing emails carry the unsubscribe link and postal address in HTML and plain text", async () => {
    const base = { unsubscribeUrl: "https://x.test/unsubscribe?c=1&t=abc", postalAddress: "1 Test St, New York, NY", bookUrl: "https://x.test/book" };
    for (const out of [campaignEmail({ ...base, lang: "es", subject: "S", body: "Hola\n\nAdiós" }), winBackEmail({ ...base, lang: "en", name: "Maya T" })]) {
      const r = await renderEmail(out);
      for (const part of [r.html, r.text]) {
        expect(part).toContain("1 Test St, New York, NY");
        expect(part.replaceAll("&amp;", "&")).toContain(base.unsubscribeUrl);
      }
    }
  });
});

describe("sending", () => {
  test("real sends are blocked without a postal address, and the count must match", async () => {
    await guest("a@x.com");
    const c = await campaign();
    await expect(startCampaign(c.id, 2, NOW)).rejects.toThrow(/list just changed/);
    await db.delete(settings);
    await expect(startCampaign(c.id, 1, NOW)).rejects.toThrow(/mailing address/);
    expect((await db.select().from(campaigns).where(eq(campaigns.id, c.id)))[0].status).toBe("draft");
  });

  test("double click and overlapping cron send each person once, each with one-click headers", async () => {
    for (let i = 0; i < 25; i++) await guest(`g${i}@x.com`);
    const c = await campaign();
    await Promise.all([startCampaign(c.id, 25, NOW), startCampaign(c.id, 25, NOW)]);
    const results = await Promise.all([sendCampaignBatch(c.id), sendCampaignBatch(c.id), finishCampaigns(5_000)]);
    expect(results.reduce((n, r) => n + r.sent, 0)).toBe(25);
    const log = await db.select().from(emailLog).where(eq(emailLog.template, "campaign"));
    expect(log).toHaveLength(25);
    expect(new Set(log.map((l) => l.to)).size).toBe(25);
    const [one] = sent;
    expect(one.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(one.headers?.["List-Unsubscribe"]).toMatch(/^<http.*\/unsubscribe\?c=.*&t=.*>$/);
    expect((await db.select().from(campaigns).where(eq(campaigns.id, c.id)))[0].status).toBe("sent");
  });

  test("a batch that runs out of time leaves the rest for cron", async () => {
    for (let i = 0; i < 12; i++) await guest(`g${i}@x.com`);
    const c = await campaign();
    await startCampaign(c.id, 12, NOW);
    expect(await sendCampaignBatch(c.id, 0)).toMatchObject({ sent: 0, remaining: 12 });
    expect(await finishCampaigns(5_000)).toMatchObject({ sent: 12, remaining: 0 });
  });

  test("someone who unsubscribes mid-send is dropped from the rest of the list", async () => {
    const stay = await guest("stay@x.com");
    const leave = await guest("leave@x.com");
    const c = await campaign();
    await startCampaign(c.id, 2, NOW);
    await unsubscribeCustomer(leave.id);
    await sendCampaignBatch(c.id);
    const sent = await db.select().from(campaignRecipients).where(eq(campaignRecipients.campaignId, c.id));
    expect(sent.map((r) => r.email)).toEqual([stay.email]);
  });

  test("an interrupted claim is reported as failed and never resent", async () => {
    await guest("a@x.com");
    const c = await campaign();
    await startCampaign(c.id, 1, NOW);
    await db.update(campaignRecipients).set({ sentAt: new Date(Date.now() - 3_600_000) }).where(eq(campaignRecipients.campaignId, c.id));
    expect(await sendCampaignBatch(c.id)).toMatchObject({ sent: 0, remaining: 0 });
    expect((await db.select().from(campaignRecipients))[0].status).toBe("failed");
    expect(await db.select().from(emailLog)).toHaveLength(0);
  });

  test("results count recipient bookings within 30 days, net of refunds", async () => {
    const g = await guest("a@x.com");
    await book(await guest("other@x.com"), { amountPaidCents: 9_999, createdAt: new Date() });
    await book(g, { createdAt: daysAgo(40), amountPaidCents: 5_000 }); // before the send
    const c = await campaign({ tags: undefined });
    await startCampaign(c.id, 2, new Date());
    await sendCampaignBatch(c.id);
    await db.update(campaignRecipients).set({ sentAt: new Date(Date.now() - 86_400_000) }).where(eq(campaignRecipients.email, "other@x.com"));
    const after = new Date();
    await book(g, { createdAt: after, status: "confirmed", amountPaidCents: 20_000, amountRefundedCents: 5_000 });
    await book(g, { createdAt: after, status: "cancelled", amountPaidCents: 7_000 });
    await book(g, { createdAt: new Date(Date.now() + 31 * 86_400_000), amountPaidCents: 3_000 });
    const s = (await campaignStats([c.id])).get(c.id)!;
    expect(s).toMatchObject({ sent: 2, failed: 0, bookings: 2, revenueCents: 24_999, testOnly: 2 });
  });
});

describe("win-back", () => {
  async function lapsed(email: string, over = {}) {
    const g = await guest(email, over);
    await book(g, { startAt: daysAgo(130) });
    return g;
  }
  const sentTo = async () => (await db.select().from(emailLog).where(eq(emailLog.template, "win_back"))).map((l) => l.to).sort();

  test("off by default, and off without a postal address", async () => {
    await lapsed("a@x.com");
    expect(await sendWinBacks(NOW, 5_000)).toEqual({ sent: 0, failed: 0 });
    await setSetting("winBackEnabled", true);
    await db.delete(settings).where(eq(settings.key, "postalAddress"));
    expect(await sendWinBacks(NOW, 5_000)).toEqual({ sent: 0, failed: 0 });
  });

  test("only lapsed, marketable guests, and once per 180 days", async () => {
    await setSetting("winBackEnabled", true);
    await lapsed("lapsed@x.com");
    await lapsed("gone@x.com", { unsubscribedAt: daysAgo(1) });
    await lapsed("no-optin@x.com", { marketingOptIn: false });
    await book(await guest("recent@x.com"), { startAt: daysAgo(30) });
    await book(await guest("airbnb@x.com"), { startAt: daysAgo(130), source: "airbnb" });

    await sendWinBacks(NOW, 5_000);
    expect(await sentTo()).toEqual(["lapsed@x.com"]);

    await sendWinBacks(new Date(NOW.getTime() + 86_400_000), 5_000);
    expect(await sentTo()).toEqual(["lapsed@x.com"]);

    await db.update(emailLog).set({ createdAt: daysAgo(181) }).where(eq(emailLog.template, "win_back"));
    await sendWinBacks(NOW, 5_000);
    expect(await sentTo()).toEqual(["lapsed@x.com", "lapsed@x.com"]);
  });
});
