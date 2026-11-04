import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, lt, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  bookingEvents,
  bookings,
  calendarFeeds,
  emailLog,
  experiences,
  giftCards,
  inquiries,
  refunds,
  reviews,
} from "@/lib/db/schema";
import { addDaysKey, fromLocal, localDateKey, todayKey, weekdayOf } from "@/lib/time";

export type SessionRow = {
  id: string;
  code: string;
  startAt: string;
  endAt: string;
  status: string;
  guests: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  occasion: string | null;
  customerNotes: string;
  internalNotes: string;
  isGift: boolean;
  giftRecipientName: string | null;
  source: string;
  experienceName: string;
  theme: string;
};

/** Confirmed/completed sessions starting in [from, to). */
export async function getSessions(from: Date, to: Date): Promise<SessionRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ b: bookings, x: { name: experiences.shortName, theme: experiences.theme } })
    .from(bookings)
    .innerJoin(experiences, eq(experiences.id, bookings.experienceId))
    .where(and(gte(bookings.startAt, from), lt(bookings.startAt, to), inArray(bookings.status, ["confirmed", "completed", "no_show"])))
    .orderBy(asc(bookings.startAt));
  return rows.map(({ b, x }) => ({
    id: b.id,
    code: b.code,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    status: b.status,
    guests: b.guests,
    contactName: b.contactName,
    contactEmail: b.contactEmail,
    contactPhone: b.contactPhone,
    occasion: b.occasion,
    customerNotes: b.customerNotes,
    internalNotes: b.internalNotes,
    isGift: b.isGift,
    giftRecipientName: b.giftRecipientName,
    source: b.source,
    experienceName: x.name,
    theme: x.theme,
  }));
}

export function monthStartKey(key: string): string {
  return `${key.slice(0, 7)}-01`;
}
export function addMonthsKey(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
/** Monday of the week containing `key`. */
export function weekStartKey(key: string): string {
  const wd = weekdayOf(key); // 0 = Sunday
  return addDaysKey(key, wd === 0 ? -6 : 1 - wd);
}

export type Kpis = {
  revenueThisMonth: number;
  revenueLastMonth: number;
  /** Last month up to the same day-of-month, for a fair comparison. */
  revenueLastMonthToDate: number;
  daily: { date: string; cents: number }[];
  sessionsThisWeek: number;
  newBookingsThisWeek: number;
  upcomingConfirmed: number;
  upcomingGuests: number;
  avgParty: number | null;
  mix: { source: string; count: number }[];
  mixTotal: number;
};

/**
 * Cash basis: card payments received (by confirmation date) + gift cards sold,
 * minus refunds issued (by refund date). Comped gift cards are not revenue.
 */
export async function getKpis(now = new Date()): Promise<Kpis> {
  const db = await getDb();
  const today = todayKey(now);
  const thisMonth = monthStartKey(today);
  const lastMonth = addMonthsKey(thisMonth, -1);
  const from30 = addDaysKey(today, -29);
  const startKey = from30 < lastMonth ? from30 : lastMonth;
  const start = fromLocal(startKey);

  const [paid, refundRows, cards] = await Promise.all([
    db
      .select({ at: sql<Date>`coalesce(${bookings.confirmedAt}, ${bookings.createdAt})`, cents: bookings.amountPaidCents })
      .from(bookings)
      .where(
        and(
          gt(bookings.amountPaidCents, 0),
          inArray(bookings.status, ["confirmed", "completed", "no_show", "cancelled"]),
          gte(sql`coalesce(${bookings.confirmedAt}, ${bookings.createdAt})`, start),
        ),
      ),
    db.select({ at: refunds.createdAt, cents: refunds.amountCents }).from(refunds).where(gte(refunds.createdAt, start)),
    db
      .select({ at: giftCards.createdAt, cents: giftCards.initialCents })
      .from(giftCards)
      .where(and(eq(giftCards.issuedByAdmin, false), ne(giftCards.status, "pending_payment"), gte(giftCards.createdAt, start))),
  ]);

  const byDay = new Map<string, number>();
  const add = (at: Date | string, cents: number) => {
    const k = localDateKey(new Date(at));
    byDay.set(k, (byDay.get(k) ?? 0) + cents);
  };
  paid.forEach((r) => add(r.at, r.cents));
  cards.forEach((r) => add(r.at, r.cents));
  refundRows.forEach((r) => add(r.at, -r.cents));

  const dayOfMonth = Number(today.slice(8, 10));
  let revenueThisMonth = 0;
  let revenueLastMonth = 0;
  let revenueLastMonthToDate = 0;
  for (const [k, v] of byDay) {
    if (k >= thisMonth && k <= today) revenueThisMonth += v;
    else if (k >= lastMonth && k < thisMonth) {
      revenueLastMonth += v;
      if (Number(k.slice(8, 10)) <= dayOfMonth) revenueLastMonthToDate += v;
    }
  }
  const daily: { date: string; cents: number }[] = [];
  for (let k = from30; k <= today; k = addDaysKey(k, 1)) daily.push({ date: k, cents: byDay.get(k) ?? 0 });

  const weekStart = fromLocal(weekStartKey(today));
  const weekEnd = fromLocal(addDaysKey(weekStartKey(today), 7));
  const since90 = new Date(now.getTime() - 90 * 86400_000);
  const live = ["confirmed", "completed", "no_show"] as const;

  const [[week], [newWeek], [upcoming], [party], mixRows] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(gte(bookings.startAt, weekStart), lt(bookings.startAt, weekEnd), inArray(bookings.status, [...live]))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(gte(bookings.createdAt, weekStart), inArray(bookings.status, [...live, "cancelled"]))),
    db
      .select({ n: sql<number>`count(*)::int`, guests: sql<number>`coalesce(sum(${bookings.guests}),0)::int` })
      .from(bookings)
      .where(and(eq(bookings.status, "confirmed"), gt(bookings.startAt, now))),
    db
      .select({ avg: sql<number | null>`avg(${bookings.guests})::float` })
      .from(bookings)
      .where(and(inArray(bookings.status, [...live]), gte(bookings.startAt, since90))),
    db
      .select({ source: bookings.source, n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(inArray(bookings.status, [...live]), gte(bookings.startAt, since90)))
      .groupBy(bookings.source),
  ]);

  const mix = mixRows.map((r) => ({ source: r.source, count: Number(r.n) })).sort((a, b) => b.count - a.count);
  return {
    revenueThisMonth,
    revenueLastMonth,
    revenueLastMonthToDate,
    daily,
    sessionsThisWeek: Number(week?.n ?? 0),
    newBookingsThisWeek: Number(newWeek?.n ?? 0),
    upcomingConfirmed: Number(upcoming?.n ?? 0),
    upcomingGuests: Number(upcoming?.guests ?? 0),
    avgParty: party?.avg == null ? null : Number(party.avg),
    mix,
    mixTotal: mix.reduce((n, m) => n + m.count, 0),
  };
}

export type Attention = {
  deliverables: { id: string; code: string; name: string; startAt: string; status: string; experience: string }[];
  calendarErrors: { eventId: string; bookingId: string; code: string; name: string; message: string; at: string }[];
  inquiries: { id: string; name: string; kind: string; groupSize: number | null; at: string; message: string }[];
  reviews: { id: string; name: string; rating: number; body: string }[];
  failedEmails: { id: string; to: string; subject: string; error: string | null; at: string; bookingId: string | null }[];
  holds: { id: string; code: string; name: string; startAt: string; expiresAt: string | null; experience: string }[];
  feeds: { id: string; name: string; error: string }[];
};

export async function getAttention(now = new Date()): Promise<Attention> {
  const db = await getDb();
  const [deliv, calErr, inq, rev, mail, holds, feeds] = await Promise.all([
    db
      .select({ id: bookings.id, code: bookings.code, name: bookings.contactName, startAt: bookings.startAt, status: bookings.deliverableStatus, experience: experiences.shortName })
      .from(bookings)
      .innerJoin(experiences, eq(experiences.id, bookings.experienceId))
      .where(and(eq(bookings.status, "completed"), eq(experiences.theme, "production"), ne(bookings.deliverableStatus, "delivered")))
      .orderBy(asc(bookings.startAt))
      .limit(20),
    db
      .select({ eventId: bookingEvents.id, bookingId: bookings.id, code: bookings.code, name: bookings.contactName, message: bookingEvents.message, at: bookingEvents.createdAt })
      .from(bookingEvents)
      .innerJoin(bookings, eq(bookings.id, bookingEvents.bookingId))
      .where(
        and(
          eq(bookingEvents.type, "calendar_error"),
          gte(bookingEvents.createdAt, new Date(now.getTime() - 30 * 86400_000)),
          sql`not exists (select 1 from booking_events r where r.booking_id = ${bookingEvents.bookingId} and r.type = 'calendar_resolved' and r.created_at >= ${bookingEvents.createdAt})`,
        ),
      )
      .orderBy(desc(bookingEvents.createdAt))
      .limit(20),
    db.select().from(inquiries).where(eq(inquiries.status, "new")).orderBy(desc(inquiries.createdAt)).limit(10),
    db.select().from(reviews).where(eq(reviews.status, "pending")).orderBy(desc(reviews.createdAt)).limit(10),
    db
      .select()
      .from(emailLog)
      .where(and(eq(emailLog.status, "failed"), gte(emailLog.createdAt, new Date(now.getTime() - 7 * 86400_000))))
      .orderBy(desc(emailLog.createdAt))
      .limit(10),
    db
      .select({ id: bookings.id, code: bookings.code, name: bookings.contactName, startAt: bookings.startAt, expiresAt: bookings.holdExpiresAt, experience: experiences.shortName })
      .from(bookings)
      .innerJoin(experiences, eq(experiences.id, bookings.experienceId))
      .where(and(eq(bookings.status, "pending_payment"), isNotNull(bookings.holdExpiresAt), gt(bookings.holdExpiresAt, new Date(now.getTime() - 5 * 60_000))))
      .orderBy(asc(bookings.holdExpiresAt))
      .limit(10),
    db
      .select({ id: calendarFeeds.id, name: calendarFeeds.name, error: calendarFeeds.lastError })
      .from(calendarFeeds)
      .where(and(eq(calendarFeeds.active, true), isNotNull(calendarFeeds.lastError))),
  ]);
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    deliverables: deliv.map((d) => ({ ...d, startAt: d.startAt.toISOString() })),
    calendarErrors: calErr.map((c) => ({ ...c, at: c.at.toISOString() })),
    inquiries: inq.map((i) => ({ id: i.id, name: i.name, kind: i.kind, groupSize: i.groupSize, at: i.createdAt.toISOString(), message: i.message })),
    reviews: rev.map((r) => ({ id: r.id, name: r.name, rating: r.rating, body: r.body })),
    failedEmails: mail.map((m) => ({ id: m.id, to: m.to, subject: m.subject, error: m.error, at: m.createdAt.toISOString(), bookingId: m.bookingId })),
    holds: holds.map((h) => ({ ...h, startAt: h.startAt.toISOString(), expiresAt: iso(h.expiresAt) })),
    feeds: feeds.map((f) => ({ id: f.id, name: f.name, error: f.error ?? "" })),
  };
}
