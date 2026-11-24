/**
 * Imported calendar feeds → availability blocks.
 *
 * Alex adds iCal links in Admin → Availability (his Google Calendar's
 * "secret address in iCal format", Airbnb's calendar export, anything else).
 * Every cron run (and "Sync now") fetches each feed and mirrors its busy
 * times into `blocks` (source ical/airbnb/viator, feedId set), so the site
 * never offers a time Alex is busy elsewhere, even without Cal.com.
 *
 * - webcal:// links are fetched over https.
 * - Window: from 1 day ago to 180 days ahead.
 * - Blocks are keyed by `${UID}#${start}` per feed: new events are inserted,
 *   moved/changed ones updated, vanished ones deleted.
 * - If a fetch fails, existing blocks are KEPT (a flaky feed must not suddenly
 *   open up booked time) and the error is stored on the feed for the admin.
 * - Echoes of our own bookings (same exact start/end as one of our live
 *   bookings, or a UID we issued) are skipped, so a Google feed that already
 *   contains our Cal.com-created events doesn't block those bookings from
 *   being rescheduled.
 * - Pausing a feed frees its times on the next full sync; deleting it frees
 *   them immediately (blocks cascade).
 * - Limitation: RRULE recurring events are not expanded (booking platforms
 *   list each occurrence; for a recurring personal event in Google, add a
 *   recurring manual block instead).
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import "server-only";
import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { blocks, bookings, calendarFeeds, type CalendarFeed } from "@/lib/db/schema";
import { parseIcsBusy } from "@/lib/ics";

export type FeedSyncResult = {
  feedId: string;
  name: string;
  ok: boolean;
  /** Busy events in the window after filtering. */
  events: number;
  added: number;
  updated: number;
  removed: number;
  /** Events skipped because they are our own bookings echoed back. */
  skippedOwn: number;
  error?: string;
};

const FETCH_TIMEOUT_MS = 15_000;
const WINDOW_PAST_MS = 24 * 3600_000;
const WINDOW_AHEAD_MS = 180 * 24 * 3600_000;
const MAX_BYTES = 5_000_000;
const OWN_UID_SUFFIX = "@rawplanetexperiences.com";

export function normalizeFeedUrl(url: string): string {
  const u = url.trim();
  return u.replace(/^webcals?:\/\//i, "https://");
}

function sourceFor(url: string): "ical" | "airbnb" | "viator" {
  const host = (() => {
    try {
      return new URL(normalizeFeedUrl(url)).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (host.includes("airbnb")) return "airbnb";
  if (host.includes("viator")) return "viator";
  return "ical";
}

/** Feeds are fetched from the server, so refuse addresses inside our own network (SSRF). */
export function isPrivateIp(ip: string): boolean {
  const v4 = ip.replace(/^::ffff:/i, "");
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const x = ip.toLowerCase();
  return x === "::" || x === "::1" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80");
}

async function assertPublicHost(u: URL): Promise<void> {
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  if (!ips.length || ips.some(isPrivateIp)) throw new Error("That feed address isn't reachable from the internet.");
}

async function fetchFeed(url: string): Promise<string> {
  let target = new URL(normalizeFeedUrl(url));
  if (!/^https?:$/.test(target.protocol)) throw new Error("Feed URL must start with https:// or webcal://");
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let res: Response | null = null;
  // Follow redirects by hand so every hop is checked. shortcut: DNS is checked before fetch, not pinned; fine for an admin-only setting.
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicHost(target);
    res = await fetch(target, {
      signal,
      headers: { "User-Agent": "RawPlanetBookings/1.0 (+calendar sync)", Accept: "text/calendar, text/plain, */*" },
      redirect: "manual",
      cache: "no-store",
    });
    const loc = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!loc) break;
    target = new URL(loc, target);
    if (!/^https?:$/.test(target.protocol)) throw new Error("Feed redirected somewhere unsupported");
    res = null;
  }
  if (!res) throw new Error("Feed redirected too many times");
  if (!res.ok) throw new Error(`Feed returned HTTP ${res.status}`);
  // Stop reading as soon as the cap is passed instead of buffering a huge body.
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = res.body?.getReader();
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new Error("Feed is too large (over 5 MB)");
    }
    chunks.push(value);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.includes("BEGIN:VCALENDAR")) throw new Error("That link didn't return an iCal calendar");
  return text;
}

type BusyEvent = { key: string; start: Date; end: Date; summary: string };

function busyInWindow(text: string, now: Date): BusyEvent[] {
  const from = new Date(now.getTime() - WINDOW_PAST_MS);
  const to = new Date(now.getTime() + WINDOW_AHEAD_MS);
  const seen = new Map<string, BusyEvent>();
  for (const e of parseIcsBusy(text)) {
    if (e.cancelled || e.end <= e.start || e.end <= from || e.start >= to) continue;
    const key = `${e.uid}#${e.start.toISOString()}`;
    seen.set(key, { key, start: e.start, end: e.end, summary: e.summary });
  }
  return [...seen.values()];
}

/** Check a link before saving it (admin "Add feed"). Never throws. */
export async function previewCalendarFeed(url: string, now = new Date()): Promise<{ ok: boolean; events: number; error?: string }> {
  try {
    const text = await fetchFeed(url);
    return { ok: true, events: busyInWindow(text, now).length };
  } catch (err) {
    return { ok: false, events: 0, error: errMsg(err) };
  }
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.name === "TimeoutError" ? "Feed timed out after 15 seconds" : err.message;
  return String(err);
}

async function syncOne(feed: CalendarFeed, now: Date): Promise<FeedSyncResult> {
  const db = await getDb();
  const base = { feedId: feed.id, name: feed.name, events: 0, added: 0, updated: 0, removed: 0, skippedOwn: 0 };
  let text: string;
  try {
    text = await fetchFeed(feed.url);
  } catch (err) {
    const error = errMsg(err);
    await db.update(calendarFeeds).set({ lastError: error }).where(eq(calendarFeeds.id, feed.id));
    return { ...base, ok: false, error };
  }

  const events = busyInWindow(text, now);
  const result = { ...base, ok: true, events: events.length };
  const source = sourceFor(feed.url);

  // Our own live bookings in the window, to drop echoes (e.g. Cal.com-written Google events).
  const own = events.length
    ? await db
        .select({ startAt: bookings.startAt, endAt: bookings.endAt })
        .from(bookings)
        .where(
          and(
            eq(bookings.resourceGroup, feed.resourceGroup),
            lt(bookings.startAt, new Date(now.getTime() + WINDOW_AHEAD_MS)),
            gt(bookings.endAt, new Date(now.getTime() - WINDOW_PAST_MS)),
            inArray(bookings.status, ["confirmed", "completed", "pending_payment"]),
          ),
        )
    : [];
  const ownKeys = new Set(own.map((b) => `${b.startAt.getTime()}-${b.endAt.getTime()}`));
  const wanted = new Map<string, BusyEvent>();
  for (const e of events) {
    const uid = e.key.slice(0, e.key.lastIndexOf("#"));
    if (uid.endsWith(OWN_UID_SUFFIX) || ownKeys.has(`${e.start.getTime()}-${e.end.getTime()}`)) {
      result.skippedOwn++;
      continue;
    }
    wanted.set(e.key, e);
  }

  await db.transaction(async (tx) => {
    const existing = await tx.select().from(blocks).where(eq(blocks.feedId, feed.id));
    const byKey = new Map(existing.map((b) => [b.externalUid ?? "", b]));
    const stale: string[] = [];
    for (const b of existing) if (!b.externalUid || !wanted.has(b.externalUid)) stale.push(b.id);
    if (stale.length) {
      await tx.delete(blocks).where(inArray(blocks.id, stale));
      result.removed = stale.length;
    }
    for (const e of wanted.values()) {
      const reason = `${feed.name}: ${e.summary}`.slice(0, 200);
      const prev = byKey.get(e.key);
      if (!prev) {
        await tx.insert(blocks).values({
          startAt: e.start,
          endAt: e.end,
          resourceGroup: feed.resourceGroup,
          reason,
          source,
          feedId: feed.id,
          externalUid: e.key,
        });
        result.added++;
      } else if (
        prev.endAt.getTime() !== e.end.getTime() ||
        prev.reason !== reason ||
        prev.resourceGroup !== feed.resourceGroup ||
        prev.source !== source
      ) {
        await tx.update(blocks).set({ endAt: e.end, reason, resourceGroup: feed.resourceGroup, source }).where(eq(blocks.id, prev.id));
        result.updated++;
      }
    }
    await tx.update(calendarFeeds).set({ lastSyncedAt: now, lastError: null }).where(eq(calendarFeeds.id, feed.id));
  });
  return result;
}

/**
 * Sync one feed (by id, even if paused) or every active feed. Never throws;
 * per-feed errors are returned and saved on the feed's `lastError`.
 * A full sync also frees the blocks of paused feeds (paused = ignored).
 */
export async function syncCalendarFeeds(feedId?: string): Promise<FeedSyncResult[]> {
  const db = await getDb();
  const now = new Date();
  const feeds = feedId
    ? await db.select().from(calendarFeeds).where(eq(calendarFeeds.id, feedId))
    : await db.select().from(calendarFeeds).where(eq(calendarFeeds.active, true));
  const out: FeedSyncResult[] = [];
  if (!feedId) {
    const paused = await db.select({ id: calendarFeeds.id }).from(calendarFeeds).where(eq(calendarFeeds.active, false));
    if (paused.length) await db.delete(blocks).where(inArray(blocks.feedId, paused.map((p) => p.id)));
  }
  for (const feed of feeds) {
    try {
      out.push(await syncOne(feed, now));
    } catch (err) {
      const error = errMsg(err);
      console.error(`[feeds] ${feed.name} failed`, err);
      await db.update(calendarFeeds).set({ lastError: error }).where(eq(calendarFeeds.id, feed.id)).catch(() => {});
      out.push({ feedId: feed.id, name: feed.name, ok: false, events: 0, added: 0, updated: 0, removed: 0, skippedOwn: 0, error });
    }
  }
  return out;
}

/** Remove every block a feed created (e.g. right after pausing it, to free its times now). */
export async function clearFeedBlocks(feedId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.delete(blocks).where(eq(blocks.feedId, feedId)).returning({ id: blocks.id });
  return rows.length;
}
