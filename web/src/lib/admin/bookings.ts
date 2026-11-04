import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bookingAddons, bookingEvents, bookings, customers, emailLog, experiences, giftCards, promoCodes, refunds, type BookingSource, type BookingStatus } from "@/lib/db/schema";
import { addDaysKey, fromLocal } from "@/lib/time";

export const VIEWS = ["upcoming", "past", "cancelled", "holds", "all"] as const;
export type BookingView = (typeof VIEWS)[number];
export const VIEW_LABEL: Record<BookingView, string> = {
  upcoming: "Upcoming",
  past: "Past",
  cancelled: "Cancelled",
  holds: "Unpaid & expired",
  all: "All",
};

const SOURCES: BookingSource[] = ["direct", "airbnb", "viator", "manual", "phone", "cal"];

export type BookingFilters = {
  view: BookingView;
  q: string;
  source: BookingSource | "";
  exp: string;
  from: string;
  to: string;
  page: number;
};

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const dateKey = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

export function parseBookingFilters(sp: SP | URLSearchParams): BookingFilters {
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) ?? "" : one(sp[k]));
  const view = get("view") as BookingView;
  const source = get("source") as BookingSource;
  return {
    view: VIEWS.includes(view) ? view : "upcoming",
    q: get("q").trim().slice(0, 100),
    source: SOURCES.includes(source) ? source : "",
    exp: get("exp").slice(0, 64),
    from: dateKey(get("from")),
    to: dateKey(get("to")),
    page: Math.max(1, Math.min(1000, Number(get("page")) || 1)),
  };
}

/** Query string for links that keep the current filters (minus defaults). */
export function filterQuery(f: BookingFilters, patch: Partial<BookingFilters> = {}): string {
  const m = { ...f, ...patch };
  const p = new URLSearchParams();
  if (m.view !== "upcoming") p.set("view", m.view);
  if (m.q) p.set("q", m.q);
  if (m.source) p.set("source", m.source);
  if (m.exp) p.set("exp", m.exp);
  if (m.from) p.set("from", m.from);
  if (m.to) p.set("to", m.to);
  if (m.page > 1) p.set("page", String(m.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

function viewWhere(view: BookingView, now: Date): SQL | undefined {
  switch (view) {
    case "upcoming":
      return and(inArray(bookings.status, ["confirmed"]), gte(bookings.endAt, now));
    case "past":
      return and(inArray(bookings.status, ["confirmed", "completed", "no_show"]), lt(bookings.endAt, now));
    case "cancelled":
      return eq(bookings.status, "cancelled");
    case "holds":
      return inArray(bookings.status, ["pending_payment", "expired"]);
    default:
      return undefined;
  }
}

function baseWhere(f: BookingFilters): SQL[] {
  const w: SQL[] = [];
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    w.push(
      or(
        ilike(bookings.contactName, like),
        ilike(bookings.contactEmail, like),
        ilike(bookings.code, like),
        ilike(bookings.externalRef, like),
        ilike(bookings.contactPhone, like),
        ilike(bookings.giftRecipientName, like),
      )!,
    );
  }
  if (f.source) w.push(eq(bookings.source, f.source));
  if (f.exp) w.push(eq(bookings.experienceId, f.exp));
  if (f.from) w.push(gte(bookings.startAt, fromLocal(f.from)));
  if (f.to) w.push(lt(bookings.startAt, fromLocal(addDaysKey(f.to, 1))));
  return w;
}

function orderFor(view: BookingView) {
  if (view === "upcoming") return [asc(bookings.startAt)];
  if (view === "holds") return [desc(bookings.createdAt)];
  return [desc(bookings.startAt)];
}

export const PAGE_SIZE = 50;

export type BookingListRow = {
  id: string;
  code: string;
  status: BookingStatus;
  paymentStatus: Booking["paymentStatus"];
  source: BookingSource;
  startAt: Date;
  endAt: Date;
  guests: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  occasion: string | null;
  isGift: boolean;
  totalCents: number;
  amountPaidCents: number;
  amountRefundedCents: number;
  externalRef: string | null;
  createdAt: Date;
  experienceName: string;
  theme: string;
};
type Booking = typeof bookings.$inferSelect;

const listCols = {
  id: bookings.id,
  code: bookings.code,
  status: bookings.status,
  paymentStatus: bookings.paymentStatus,
  source: bookings.source,
  startAt: bookings.startAt,
  endAt: bookings.endAt,
  guests: bookings.guests,
  contactName: bookings.contactName,
  contactEmail: bookings.contactEmail,
  contactPhone: bookings.contactPhone,
  occasion: bookings.occasion,
  isGift: bookings.isGift,
  totalCents: bookings.totalCents,
  amountPaidCents: bookings.amountPaidCents,
  amountRefundedCents: bookings.amountRefundedCents,
  externalRef: bookings.externalRef,
  createdAt: bookings.createdAt,
  experienceName: experiences.shortName,
  theme: experiences.theme,
};

export async function listBookings(f: BookingFilters, opts: { limit?: number; now?: Date } = {}) {
  const db = await getDb();
  const now = opts.now ?? new Date();
  const base = baseWhere(f);
  const where = and(...base, viewWhere(f.view, now));
  const limit = opts.limit ?? PAGE_SIZE;
  const [rows, counts] = await Promise.all([
    db
      .select(listCols)
      .from(bookings)
      .innerJoin(experiences, eq(experiences.id, bookings.experienceId))
      .where(where)
      .orderBy(...orderFor(f.view))
      .limit(limit + 1)
      .offset(opts.limit ? 0 : (f.page - 1) * PAGE_SIZE),
    db
      .select({
        upcoming: sql<number>`count(*) filter (where ${viewWhere("upcoming", now)})::int`,
        past: sql<number>`count(*) filter (where ${viewWhere("past", now)})::int`,
        cancelled: sql<number>`count(*) filter (where ${viewWhere("cancelled", now)})::int`,
        holds: sql<number>`count(*) filter (where ${viewWhere("holds", now)})::int`,
        all: sql<number>`count(*)::int`,
      })
      .from(bookings)
      .where(base.length ? and(...base) : undefined),
  ]);
  const c = counts[0];
  return {
    rows: rows.slice(0, limit) as BookingListRow[],
    hasMore: rows.length > limit,
    counts: {
      upcoming: Number(c?.upcoming ?? 0),
      past: Number(c?.past ?? 0),
      cancelled: Number(c?.cancelled ?? 0),
      holds: Number(c?.holds ?? 0),
      all: Number(c?.all ?? 0),
    } satisfies Record<BookingView, number>,
  };
}

export async function experienceOptions() {
  const db = await getDb();
  return db
    .select({
      id: experiences.id,
      name: experiences.name,
      shortName: experiences.shortName,
      theme: experiences.theme,
      active: experiences.active,
      durationOptions: experiences.durationOptions,
      minGuests: experiences.minGuests,
      maxGuests: experiences.maxGuests,
      pricingMode: experiences.pricingMode,
      includedGuests: experiences.includedGuests,
      extraGuestCents: experiences.extraGuestCents,
    })
    .from(experiences)
    .orderBy(asc(experiences.sortOrder), asc(experiences.name));
}
export type ExperienceOption = Awaited<ReturnType<typeof experienceOptions>>[number];

/* ------------------------------ detail ------------------------------ */

export async function getBookingDetail(id: string) {
  const db = await getDb();
  const [row] = await db
    .select({ b: bookings, x: experiences })
    .from(bookings)
    .innerJoin(experiences, eq(experiences.id, bookings.experienceId))
    .where(or(eq(bookings.id, id), eq(bookings.code, id.toUpperCase())))
    .limit(1);
  if (!row) return null;
  const b = row.b;
  const [events, refundRows, addonRows, emails, gift, promo, customer, otherBookings] = await Promise.all([
    db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, b.id)).orderBy(desc(bookingEvents.createdAt), desc(bookingEvents.id)),
    db.select().from(refunds).where(eq(refunds.bookingId, b.id)).orderBy(desc(refunds.createdAt)),
    db.select().from(bookingAddons).where(eq(bookingAddons.bookingId, b.id)),
    db
      .select({ id: emailLog.id, subject: emailLog.subject, status: emailLog.status, template: emailLog.template, to: emailLog.to, createdAt: emailLog.createdAt, error: emailLog.error })
      .from(emailLog)
      .where(eq(emailLog.bookingId, b.id))
      .orderBy(desc(emailLog.createdAt)),
    b.giftCardId ? db.select({ id: giftCards.id, code: giftCards.code }).from(giftCards).where(eq(giftCards.id, b.giftCardId)).limit(1) : Promise.resolve([]),
    b.promoCodeId ? db.select({ id: promoCodes.id, code: promoCodes.code }).from(promoCodes).where(eq(promoCodes.id, b.promoCodeId)).limit(1) : Promise.resolve([]),
    b.customerId ? db.select().from(customers).where(eq(customers.id, b.customerId)).limit(1) : Promise.resolve([]),
    b.customerId
      ? db.select({ n: sql<number>`count(*)::int` }).from(bookings).where(and(eq(bookings.customerId, b.customerId), inArray(bookings.status, ["confirmed", "completed", "no_show"])))
      : Promise.resolve([{ n: 0 }]),
  ]);
  let rescheduledFrom: { id: string; code: string } | null = null;
  if (b.rescheduledFromId) {
    const [r] = await db.select({ id: bookings.id, code: bookings.code }).from(bookings).where(eq(bookings.id, b.rescheduledFromId)).limit(1);
    rescheduledFrom = r ?? null;
  }
  return {
    booking: b,
    experience: row.x,
    events,
    refunds: refundRows,
    addons: addonRows,
    emails,
    giftCard: gift[0] ?? null,
    promo: promo[0] ?? null,
    customer: customer[0] ?? null,
    customerBookings: Number(otherBookings[0]?.n ?? 0),
    rescheduledFrom,
  };
}
