import "server-only";
import { and, asc, eq, gt, inArray, lt, ne, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { blocks, bookings, calendarFeeds, events, experiences } from "@/lib/db/schema";

export type CalItem = {
  id: string;
  kind: "booking" | "hold" | "block" | "event";
  start: string;
  end: string;
  title: string;
  sub: string;
  theme: string;
  href: string;
  status?: string;
  source?: string;
};

/** Everything that occupies time in [from, to): sessions, checkout holds, blocks (manual + imported), community events. */
export async function getCalendarItems(from: Date, to: Date, now = new Date()): Promise<CalItem[]> {
  const db = await getDb();
  const [bk, bl, ev] = await Promise.all([
    db
      .select({
        id: bookings.id,
        code: bookings.code,
        startAt: bookings.startAt,
        endAt: bookings.endAt,
        status: bookings.status,
        holdExpiresAt: bookings.holdExpiresAt,
        name: bookings.contactName,
        guests: bookings.guests,
        source: bookings.source,
        exp: experiences.shortName,
        theme: experiences.theme,
      })
      .from(bookings)
      .innerJoin(experiences, eq(experiences.id, bookings.experienceId))
      .where(
        and(
          lt(bookings.startAt, to),
          gt(bookings.endAt, from),
          or(inArray(bookings.status, ["confirmed", "completed", "no_show"]), and(eq(bookings.status, "pending_payment"), gt(bookings.holdExpiresAt, now))),
        ),
      )
      .orderBy(asc(bookings.startAt)),
    db
      .select({
        id: blocks.id,
        startAt: blocks.startAt,
        endAt: blocks.endAt,
        reason: blocks.reason,
        source: blocks.source,
        feedName: calendarFeeds.name,
        exp: experiences.shortName,
      })
      .from(blocks)
      .leftJoin(calendarFeeds, eq(calendarFeeds.id, blocks.feedId))
      .leftJoin(experiences, eq(experiences.id, blocks.experienceId))
      .where(and(lt(blocks.startAt, to), gt(blocks.endAt, from)))
      .orderBy(asc(blocks.startAt)),
    db
      .select({ id: events.id, title: events.title, startAt: events.startAt, endAt: events.endAt, venue: events.venue })
      .from(events)
      .where(and(lt(events.startAt, to), gt(events.endAt, from), ne(events.status, "cancelled")))
      .orderBy(asc(events.startAt)),
  ]);

  const items: CalItem[] = [
    ...bk.map((b) => ({
      id: b.id,
      kind: (b.status === "pending_payment" ? "hold" : "booking") as CalItem["kind"],
      start: b.startAt.toISOString(),
      end: b.endAt.toISOString(),
      title: b.status === "pending_payment" ? `${b.name} (paying…)` : b.name,
      sub: `${b.exp} · ${b.guests}`,
      theme: b.theme,
      href: `/admin/bookings/${b.id}`,
      status: b.status,
      source: b.source,
    })),
    ...bl.map((b) => ({
      id: b.id,
      kind: "block" as const,
      start: b.startAt.toISOString(),
      end: b.endAt.toISOString(),
      title: b.reason || (b.source === "manual" ? "Blocked" : b.feedName ? `Busy (${b.feedName})` : "Busy"),
      sub: b.source === "manual" ? (b.exp ? `${b.exp} only` : "Blocked") : `From ${b.feedName ?? b.source}`,
      theme: "block",
      href: "",
      source: b.source,
    })),
    ...ev.map((e) => ({
      id: e.id,
      kind: "event" as const,
      start: e.startAt.toISOString(),
      end: e.endAt.toISOString(),
      title: e.title,
      sub: e.venue || "Community event",
      theme: "event",
      href: `/admin/events/${e.id}`,
    })),
  ];
  return items.sort((x, y) => x.start.localeCompare(y.start));
}
