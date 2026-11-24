/**
 * Marketing email: who may receive it, sending, and results. Campaigns and the win-back job both
 * go through marketable(), so the legal rules live in exactly one place.
 */
import "server-only";
import { and, asc, eq, inArray, isNotNull, isNull, lt, notInArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { campaignRecipients, campaigns, customers, type Campaign, type CampaignSegment } from "@/lib/db/schema";
import { getSetting, getStringSetting } from "@/lib/automation/settings";
import { MAX_SEND_ATTEMPTS, PLATFORM_SOURCES } from "@/lib/automation/rules";
import { hostNotificationEmail, integrations, siteUrl } from "@/lib/config";
import { sendEmail } from "@/lib/email/send";
import { unsubUrl } from "@/lib/unsubscribe-token";
import { renderEmail } from "@/emails/render";
import { langOf, type Lang } from "@/emails/i18n";
import { campaignEmail, winBackEmail } from "@/emails/templates/campaign";
import type { EmailOutput } from "@/emails/types";
import { rows } from "./badges";

const DAY = 86_400_000;
const BATCH = 10;
const SEND_BUDGET_MS = 40_000; // leaves room inside the 60-second limit for the batch in flight
const PACE_MS = 550; // stays under Resend's per-second limit; a burst would fail real sends
const STALE_CLAIM_MS = 10 * 60_000;
const WIN_BACK_AFTER_DAYS = 120;
const WIN_BACK_EVERY_DAYS = 180;
const WIN_BACK_PER_RUN = 30;
const TEST_MODE_NOTE = "Test mode: logged, not delivered";

export const POSTAL_ADDRESS_MISSING = "Add your mailing address in Settings first. The law (CAN-SPAM) requires a postal address on every marketing email.";

const list = (vals: string[]) => sql.join(vals.map((v) => sql`${v}`), sql`, `);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A booking belongs to a customer by link or by email (getCustomerDetail matches the same way). */
const isTheirs = sql`(b.customer_id = ${customers.id} or lower(b.contact_email) = ${customers.email})`;

/**
 * Who may legally get marketing: said yes, never unsubscribed, a real address, and not someone we
 * only know through Airbnb or Viator (those contact details belong to the platforms' terms).
 * An unpaid or abandoned checkout doesn't count as a direct relationship.
 */
function marketable(): SQL {
  const platforms = list([...PLATFORM_SOURCES]);
  return and(
    eq(customers.marketingOptIn, true),
    isNull(customers.unsubscribedAt),
    sql`${customers.email} like '%@%'`,
    sql`lower(${customers.email}) not like '%.invalid'`,
    sql`not (
      exists (select 1 from bookings b where ${isTheirs} and b.source in (${platforms}))
      and not exists (select 1 from bookings b where ${isTheirs} and b.source not in (${platforms}) and b.status not in ('pending_payment', 'expired'))
    )`,
  )!;
}

/** Nothing marks a session completed unless Alex taps it, so a past confirmed booking counts too (as the follow-up emails do). */
function segmentWhere(seg: CampaignSegment, now: Date): SQL[] {
  const done = sql`${isTheirs} and b.status in ('confirmed', 'completed') and b.end_at <= ${now.toISOString()}::timestamptz`;
  const where = [marketable()];
  if (seg.tags?.length) where.push(sql`exists (select 1 from jsonb_array_elements_text(${customers.tags}) t(v) where t.v in (${list(seg.tags)}))`);
  if (seg.experienceIds?.length) where.push(sql`exists (select 1 from bookings b where ${done} and b.experience_id in (${list(seg.experienceIds)}))`);
  if (seg.lapsedDays) {
    const cutoff = new Date(now.getTime() - seg.lapsedDays * DAY).toISOString();
    where.push(sql`exists (select 1 from bookings b where ${done})`);
    // end_at past the cutoff also catches an upcoming session: that guest hasn't lapsed.
    where.push(sql`not exists (select 1 from bookings b where ${isTheirs} and b.status in ('confirmed', 'completed') and b.end_at > ${cutoff}::timestamptz)`);
  }
  if (seg.minSessions) where.push(sql`(select count(*) from bookings b where ${done}) >= ${seg.minSessions}`);
  if (seg.language) where.push(eq(customers.language, seg.language));
  return where;
}

export async function segmentRecipients(seg: CampaignSegment, now = new Date()) {
  const db = await getDb();
  return db
    .select({ customerId: customers.id, email: customers.email })
    .from(customers)
    .where(and(...segmentWhere(seg, now)))
    .orderBy(asc(customers.createdAt));
}

export async function countRecipients(seg: CampaignSegment, now = new Date()): Promise<number> {
  const db = await getDb();
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(customers).where(and(...segmentWhere(seg, now)));
  return Number(r?.n ?? 0);
}

const blank = (v: unknown) => (v === "" || v === null ? undefined : v);
const positive = z.preprocess(blank, z.coerce.number().int("Use a whole number.").min(1).max(10_000).optional());
const segmentSchema = z.object({
  tags: z.array(z.string().max(40)).max(50),
  experienceIds: z.array(z.string().max(64)).max(50),
  lapsedDays: positive,
  minSessions: positive,
  language: z.preprocess(blank, z.enum(["en", "es"]).optional()),
});

/** The segment builder's fields, shared by Save and the live count. */
export function segmentFromForm(fd: FormData): CampaignSegment {
  const s = segmentSchema.parse({
    tags: fd.getAll("tags"),
    experienceIds: fd.getAll("experienceIds"),
    lapsedDays: fd.get("lapsedDays"),
    minSessions: fd.get("minSessions"),
    language: fd.get("language"),
  });
  return { ...s, tags: s.tags.length ? s.tags : undefined, experienceIds: s.experienceIds.length ? s.experienceIds : undefined };
}

export const postalAddress = () => getStringSetting("postalAddress");

async function sendMarketing(opts: { to: string; customerId: string; lang: Lang; template: string; build: (url: string) => EmailOutput }) {
  const url = unsubUrl(opts.customerId, opts.lang);
  const r = await renderEmail(opts.build(url));
  return sendEmail({
    to: opts.to,
    subject: r.subject,
    html: r.html,
    text: r.text,
    template: opts.template,
    headers: { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
}

const campaignOutput = (c: Pick<Campaign, "subject" | "body">, lang: Lang, unsubscribeUrl: string, address: string | null) =>
  campaignEmail({ lang, subject: c.subject, body: c.body, unsubscribeUrl, postalAddress: address, bookUrl: siteUrl("/book") });

/** The draft as a recipient would see it, for the sandboxed preview. */
export async function campaignPreviewHtml(c: Campaign): Promise<string> {
  const lang = langOf(c.segment.language);
  return (await renderEmail(campaignOutput(c, lang, unsubUrl("test", lang), await postalAddress()))).html;
}

/** Always allowed, even with no mailing address yet. The "test" id makes the unsubscribe link a harmless demo. */
export async function sendCampaignTest(c: Campaign): Promise<{ ok: boolean; to: string; error?: string }> {
  const to = hostNotificationEmail();
  const lang = langOf(c.segment.language);
  const address = await postalAddress();
  const res = await sendMarketing({
    to,
    customerId: "test",
    lang,
    template: "campaign_test",
    build: (url) => campaignOutput({ ...c, subject: `[Test] ${c.subject}` }, lang, url, address),
  });
  return { ok: res.ok, to, error: res.error };
}

/** Freezes the recipient list. A double click finds the campaign already started and changes nothing. */
export async function startCampaign(id: string, expected: number, now = new Date()): Promise<void> {
  const db = await getDb();
  const [c] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (!c) throw new Error("Campaign not found.");
  if (c.status !== "draft") return;
  if (!(await postalAddress())) throw new Error(POSTAL_ADDRESS_MISSING);
  if (!c.subject.trim() || !c.body.trim()) throw new Error("Add a subject and a message, then save.");
  const people = await segmentRecipients(c.segment, now);
  if (!people.length) throw new Error("Nobody matches this audience yet.");
  if (people.length !== expected) throw new Error(`The list just changed: it's now ${people.length}. Check it and confirm again.`);
  await db.transaction(async (tx) => {
    const [won] = await tx
      .update(campaigns)
      .set({ status: "sending", updatedAt: now })
      .where(and(eq(campaigns.id, id), eq(campaigns.status, "draft")))
      .returning({ id: campaigns.id });
    if (won) await tx.insert(campaignRecipients).values(people.map((p) => ({ ...p, campaignId: id }))).onConflictDoNothing();
  });
}

/**
 * Sends what it can within the budget. A row is claimed by stamping sentAt while still "pending",
 * so overlapping callers take different rows; a claim that never finished is reported as failed
 * and never retried, because that email may have gone out.
 */
export async function sendCampaignBatch(id: string, budgetMs = SEND_BUDGET_MS): Promise<{ sent: number; failed: number; remaining: number }> {
  const db = await getDb();
  const out = { sent: 0, failed: 0, remaining: 0 };
  const [c] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (!c || c.status !== "sending") return out;
  const pending = and(eq(campaignRecipients.campaignId, id), eq(campaignRecipients.status, "pending"));
  const address = await postalAddress();
  const stop = Date.now() + budgetMs;
  const live = integrations.resend();

  while (address && Date.now() < stop) {
    // Sends can span days: anyone who unsubscribed since the list was frozen drops off here.
    const stillOk = db.select({ id: customers.id }).from(customers).where(marketable());
    await db.delete(campaignRecipients).where(and(pending, isNull(campaignRecipients.sentAt), sql`(${campaignRecipients.customerId} is null or ${notInArray(campaignRecipients.customerId, stillOk)})`));

    const next = db.select({ id: campaignRecipients.id }).from(campaignRecipients).where(and(pending, isNull(campaignRecipients.sentAt))).orderBy(asc(campaignRecipients.createdAt)).limit(BATCH).for("update", { skipLocked: true });
    const claimed = await db.update(campaignRecipients).set({ sentAt: new Date() }).where(inArray(campaignRecipients.id, next)).returning();
    if (!claimed.length) break;

    const people = await db.select({ id: customers.id, language: customers.language }).from(customers).where(inArray(customers.id, claimed.map((r) => r.customerId!)));
    const langs = new Map(people.map((p) => [p.id, langOf(p.language)]));
    for (const r of claimed) {
      const t0 = Date.now();
      const lang = langs.get(r.customerId!) ?? "en";
      const res = await sendMarketing({ to: r.email, customerId: r.customerId!, lang, template: "campaign", build: (url) => campaignOutput(c, lang, url, address) }).catch((err) => ({ ok: false, error: err instanceof Error ? err.message : String(err) }));
      await db
        .update(campaignRecipients)
        .set(res.ok ? { status: "sent", error: live ? null : TEST_MODE_NOTE } : { status: "failed", error: res.error ?? "Send failed", sentAt: null })
        .where(eq(campaignRecipients.id, r.id));
      out[res.ok ? "sent" : "failed"]++;
      if (live) await sleep(Math.max(0, PACE_MS - (Date.now() - t0)));
    }
  }

  await db
    .update(campaignRecipients)
    .set({ status: "failed", error: "Interrupted mid-send, so it may or may not have arrived. Not retried, to avoid a double send." })
    .where(and(pending, isNotNull(campaignRecipients.sentAt), lt(campaignRecipients.sentAt, new Date(Date.now() - STALE_CLAIM_MS))));
  const [left] = await db.select({ n: sql<number>`count(*)::int` }).from(campaignRecipients).where(pending);
  out.remaining = Number(left?.n ?? 0);
  if (out.remaining === 0) await db.update(campaigns).set({ status: "sent", sentAt: new Date(), updatedAt: new Date() }).where(and(eq(campaigns.id, id), eq(campaigns.status, "sending")));
  return out;
}

/** Cron: finish whatever the in-request batches left. */
export async function finishCampaigns(budgetMs: number) {
  const db = await getDb();
  const total = { sent: 0, failed: 0, remaining: 0 };
  const stop = Date.now() + budgetMs;
  for (const c of await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.status, "sending")).orderBy(asc(campaigns.createdAt))) {
    const r = await sendCampaignBatch(c.id, Math.max(0, stop - Date.now()));
    total.sent += r.sent;
    total.failed += r.failed;
    total.remaining += r.remaining;
  }
  return total;
}

/**
 * Lapsed guests who haven't had this note in 180 days. email_log is the record, which is safe
 * because jobs run under the cron lease, so two runs can't pick the same guest. Failures retry on
 * later runs up to the usual limit. Anyone past the per-run cap simply goes on the next run.
 */
export async function sendWinBacks(now: Date, budgetMs: number) {
  const out = { sent: 0, failed: 0 };
  if ((await getSetting<boolean>("winBackEnabled")) !== true) return out;
  const address = await postalAddress();
  if (!address) return out;
  const db = await getDb();
  const since = new Date(now.getTime() - WIN_BACK_EVERY_DAYS * DAY).toISOString();
  const logged = sql`from email_log l where l.template = 'win_back' and l."to" = ${customers.email} and l.created_at > ${since}::timestamptz`;
  const due = await db
    .select({ id: customers.id, email: customers.email, name: customers.name, language: customers.language })
    .from(customers)
    .where(
      and(
        ...segmentWhere({ lapsedDays: WIN_BACK_AFTER_DAYS }, now),
        sql`not exists (select 1 ${logged} and l.status in ('sent', 'logged'))`,
        sql`(select count(*) ${logged} and l.status = 'failed') < ${MAX_SEND_ATTEMPTS}`,
      ),
    )
    .orderBy(asc(customers.createdAt))
    .limit(WIN_BACK_PER_RUN);

  const stop = Date.now() + budgetMs;
  const live = integrations.resend();
  for (const g of due) {
    if (Date.now() >= stop) break;
    const t0 = Date.now();
    const lang = langOf(g.language);
    const res = await sendMarketing({
      to: g.email,
      customerId: g.id,
      lang,
      template: "win_back",
      build: (url) => winBackEmail({ lang, name: g.name, unsubscribeUrl: url, postalAddress: address, bookUrl: siteUrl("/book") }),
    }).catch(() => ({ ok: false }));
    out[res.ok ? "sent" : "failed"]++;
    if (live) await sleep(Math.max(0, PACE_MS - (Date.now() - t0)));
  }
  return out;
}

/** The link's whole job. marketingOptIn goes false too, so the customer screens and CSV agree. */
export async function unsubscribeCustomer(customerId: string): Promise<void> {
  const db = await getDb();
  await db.update(customers).set({ marketingOptIn: false, unsubscribedAt: new Date(), updatedAt: new Date() }).where(and(eq(customers.id, customerId), isNull(customers.unsubscribedAt)));
}

export type CampaignStats = { sent: number; failed: number; pending: number; testOnly: number; bookings: number; revenueCents: number };

/** Per-campaign results. A booking counts if a recipient made it within 30 days of their send. */
export async function campaignStats(ids: string[]): Promise<Map<string, CampaignStats>> {
  const out = new Map<string, CampaignStats>(ids.map((id) => [id, { sent: 0, failed: 0, pending: 0, testOnly: 0, bookings: 0, revenueCents: 0 }]));
  if (!ids.length) return out;
  const db = await getDb();
  const counts = await db
    .select({
      id: campaignRecipients.campaignId,
      sent: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'sent')::int`,
      failed: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'failed')::int`,
      pending: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'pending')::int`,
      testOnly: sql<number>`count(*) filter (where ${campaignRecipients.status} = 'sent' and ${campaignRecipients.error} = ${TEST_MODE_NOTE})::int`,
    })
    .from(campaignRecipients)
    .where(inArray(campaignRecipients.campaignId, ids))
    .groupBy(campaignRecipients.campaignId);
  for (const r of counts) Object.assign(out.get(r.id)!, { sent: Number(r.sent), failed: Number(r.failed), pending: Number(r.pending), testOnly: Number(r.testOnly) });

  const made = rows<{ campaign_id: string; bookings: number; revenue: number }>(
    await db.execute(sql`
      select x.campaign_id, count(*)::int as bookings, coalesce(sum(x.net), 0)::int as revenue
      from (
        select distinct r.campaign_id, b.id, b.amount_paid_cents - b.amount_refunded_cents as net
        from campaign_recipients r
        join bookings b on b.customer_id = r.customer_id or lower(b.contact_email) = r.email
        where r.campaign_id in (${list(ids)}) and r.status = 'sent'
          and b.created_at >= r.sent_at and b.created_at < r.sent_at + interval '30 days'
          and b.status in ('confirmed', 'completed', 'no_show')
      ) x
      group by x.campaign_id`),
  );
  for (const r of made) Object.assign(out.get(r.campaign_id)!, { bookings: Number(r.bookings), revenueCents: Number(r.revenue) });
  return out;
}
