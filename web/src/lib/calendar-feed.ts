/**
 * The host's private export feed: every confirmed booking (all sources) and
 * every published community event as an iCal subscription, at
 * /api/calendar/<secret token>.ics. Alex can subscribe to it from Google
 * Calendar, Apple Calendar or his phone. The token lives in settings
 * `calendarFeedToken`; regenerating it kills the old link.
 *
 * When Cal.com is connected, site bookings already land in Google through
 * Cal.com, so this feed is mainly a read-only overview (and the fallback that
 * puts site bookings in Google when Cal.com isn't set up).
 */
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bookings, events, experiences } from "@/lib/db/schema";
import { BUSINESS, siteUrl } from "@/lib/config";
import { buildIcs, type IcsEvent } from "@/lib/ics";
import { newToken } from "@/lib/ids";
import { getStringSetting, setSetting } from "@/lib/automation/settings";

const TOKEN_KEY = "calendarFeedToken";
const PAST_DAYS = 60;
const AHEAD_DAYS = 365;

const SOURCE_LABEL: Record<string, string> = {
  direct: "Website",
  airbnb: "Airbnb",
  viator: "Viator",
  manual: "Manual",
  cal: "Cal.com",
  phone: "Phone",
};

async function ensureToken(): Promise<string> {
  const existing = await getStringSetting(TOKEN_KEY);
  if (existing) return existing;
  const token = newToken();
  await setSetting(TOKEN_KEY, token);
  return token;
}

const urlFor = (token: string) => siteUrl(`/api/calendar/${token}.ics`);

/** https URL of the private feed (creates the token on first use). */
export async function getCalendarFeedUrl(): Promise<string> {
  return urlFor(await ensureToken());
}

/** Issue a new secret token (the old link stops working). Returns the NEW feed URL. */
export async function regenerateCalendarFeedToken(): Promise<string> {
  const token = newToken();
  await setSetting(TOKEN_KEY, token);
  return urlFor(token);
}

function sameToken(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function verifyCalendarFeedToken(token: string): Promise<boolean> {
  const current = await getStringSetting(TOKEN_KEY);
  return Boolean(current && token && sameToken(current, token));
}

/** The .ics body for the export feed. */
export async function buildCalendarFeed(now = new Date()): Promise<string> {
  const db = await getDb();
  const from = new Date(now.getTime() - PAST_DAYS * 86400_000);
  const to = new Date(now.getTime() + AHEAD_DAYS * 86400_000);
  const rows = await db
    .select({ b: bookings, e: { name: experiences.name, shortName: experiences.shortName, address: experiences.address, locationArea: experiences.locationArea } })
    .from(bookings)
    .innerJoin(experiences, eq(bookings.experienceId, experiences.id))
    .where(and(inArray(bookings.status, ["confirmed", "completed", "no_show"]), lt(bookings.startAt, to), gt(bookings.endAt, from)))
    .orderBy(asc(bookings.startAt));
  const community = await db
    .select()
    .from(events)
    .where(and(eq(events.status, "published"), lt(events.startAt, to), gt(events.endAt, from)));

  const items: IcsEvent[] = rows.map(({ b, e }) => {
    const src = SOURCE_LABEL[b.source] ?? b.source;
    const description = [
      `${b.code} · ${src}${b.externalRef ? ` (${b.externalRef})` : ""}`,
      `${b.contactName} · ${b.guests} guest${b.guests === 1 ? "" : "s"}${b.language === "es" ? " · Español" : ""}`,
      [b.contactPhone, b.contactEmail.endsWith(".invalid") ? null : b.contactEmail].filter(Boolean).join(" · ") || null,
      b.occasion ? `Occasion: ${b.occasion}` : null,
      b.isGift && b.giftRecipientName ? `Gift for ${b.giftRecipientName}` : null,
      b.customerNotes ? `Guest notes: ${b.customerNotes}` : null,
      b.status === "no_show" ? "Marked no-show" : null,
      `Admin: ${siteUrl(`/admin/bookings/${b.id}`)}`,
    ]
      .filter(Boolean)
      .join("\n");
    return {
      uid: `${b.id}@rawplanetexperiences.com`,
      start: b.startAt,
      end: b.endAt,
      summary: `${e.shortName} · ${b.contactName} (${b.guests})${b.source !== "direct" ? ` · ${src}` : ""}`,
      description,
      location: e.address || e.locationArea,
      url: siteUrl(`/admin/bookings/${b.id}`),
      status: "CONFIRMED",
      sequence: Math.floor(b.updatedAt.getTime() / 1000) % 2_000_000_000,
    };
  });
  for (const ev of community) {
    items.push({
      uid: `event-${ev.id}@rawplanetexperiences.com`,
      start: ev.startAt,
      end: ev.endAt,
      summary: `${ev.title} · Community`,
      description: [ev.summary, siteUrl(`/events/${ev.slug}`)].filter(Boolean).join("\n\n"),
      location: [ev.venue, ev.address].filter(Boolean).join(", ") || undefined,
      url: siteUrl(`/events/${ev.slug}`),
      status: "CONFIRMED",
      sequence: Math.floor(ev.updatedAt.getTime() / 1000) % 2_000_000_000,
    });
  }
  return buildIcs(items, { name: `${BUSINESS.shortName} bookings` });
}
