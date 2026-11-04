/**
 * syncCalendarFeeds against a throwaway PGlite database (its own temp dir,
 * never the dev server's .data/pglite) with fetch stubbed.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "rp-feeds-"));
process.env.PGLITE_DIR = dir;

type Mods = {
  feeds: typeof import("@/lib/feeds");
  db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>;
  s: typeof import("@/lib/db/schema");
  eq: typeof import("drizzle-orm").eq;
};
let m: Mods;
let feedId: string;
let body = "";
let fail = false;

const day = (offsetDays: number, h: number) => {
  const d = new Date(Date.now() + offsetDays * 86400_000);
  d.setUTCHours(h, 0, 0, 0);
  return d;
};
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const ev = (uid: string, a: Date, b: Date, extra: string[] = []) =>
  ["BEGIN:VEVENT", `UID:${uid}`, `DTSTART:${stamp(a)}`, `DTEND:${stamp(b)}`, "SUMMARY:Busy", ...extra, "END:VEVENT"].join("\r\n");
const cal = (...events: string[]) => ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\r\n");

beforeAll(async () => {
  vi.stubGlobal("fetch", async () => (fail ? new Response("nope", { status: 500 }) : new Response(body, { status: 200 })));
  const [feeds, dbm, s, orm] = await Promise.all([import("@/lib/feeds"), import("@/lib/db"), import("@/lib/db/schema"), import("drizzle-orm")]);
  const db = await dbm.getDb();
  m = { feeds, db, s, eq: orm.eq };
  const [f] = await db.insert(s.calendarFeeds).values({ name: "Google", url: "webcal://calendar.google.com/x.ics" }).returning();
  feedId = f.id;
}, 240_000);

afterAll(() => {
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});

const blocksOf = () => m.db.select().from(m.s.blocks).where(m.eq(m.s.blocks.feedId, feedId));

describe("syncCalendarFeeds", () => {
  it("imports busy events in the window, skipping free/cancelled ones and our own UIDs", async () => {
    body = cal(
      ev("a", day(2, 15), day(2, 17)),
      ev("b", day(3, 15), day(3, 16)),
      ev("free", day(4, 15), day(4, 16), ["TRANSP:TRANSPARENT"]),
      ev("gone", day(5, 15), day(5, 16), ["STATUS:CANCELLED"]),
      ev("x@rawplanetexperiences.com", day(6, 15), day(6, 16)),
      ev("far", day(400, 15), day(400, 16)),
    );
    const [r] = await m.feeds.syncCalendarFeeds();
    expect(r).toMatchObject({ ok: true, events: 3, added: 2, skippedOwn: 1 });
    const rows = await blocksOf();
    expect(rows.map((b) => b.reason).sort()).toEqual(["Google: Busy", "Google: Busy"]);
    expect(rows.every((b) => b.source === "ical")).toBe(true);
  });

  it("updates moved events and removes vanished ones; a re-sync is a no-op", async () => {
    body = cal(ev("a", day(2, 15), day(2, 18)));
    const [r] = await m.feeds.syncCalendarFeeds(feedId);
    expect(r).toMatchObject({ ok: true, updated: 1, removed: 1, added: 0 });
    const [again] = await m.feeds.syncCalendarFeeds(feedId);
    expect(again).toMatchObject({ added: 0, updated: 0, removed: 0 });
    expect((await blocksOf()).length).toBe(1);
  });

  it("keeps existing blocks and records the error when the feed can't be fetched", async () => {
    fail = true;
    const [r] = await m.feeds.syncCalendarFeeds(feedId);
    fail = false;
    expect(r.ok).toBe(false);
    expect(r.error).toContain("500");
    expect((await blocksOf()).length).toBe(1);
    const [f] = await m.db.select().from(m.s.calendarFeeds).where(m.eq(m.s.calendarFeeds.id, feedId));
    expect(f.lastError).toContain("500");
  });

  it("frees a paused feed's times on the next full sync", async () => {
    await m.db.update(m.s.calendarFeeds).set({ active: false }).where(m.eq(m.s.calendarFeeds.id, feedId));
    expect(await m.feeds.syncCalendarFeeds()).toEqual([]);
    expect((await blocksOf()).length).toBe(0);
  });
});
