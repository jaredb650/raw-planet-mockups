/**
 * Reports. Revenue comes from getCashEntries, the same cash basis as the Today
 * KPIs. Everything else is counted over sessions that start inside the range.
 * Pure calculations are exported and unit-tested (tests/unit/reports.test.ts).
 */
import "server-only";
import { TZDate } from "@date-fns/tz";
import { and, asc, eq, gt, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { blocks, bookings, experiences, giftCards, giftCardTransactions, promoCodes, type Experience } from "@/lib/db/schema";
import { SOURCE_LABEL } from "@/components/admin/format";
import { addDaysKey, dateRange, fmt, fromLocal, todayKey, TZ, weekdayOf } from "@/lib/time";
import { addMonthsKey, getCashEntries, monthStartKey, type CashEntry } from "./dashboard";

const H = 3600_000;
const DAY = 24 * H;
const LIVE = ["confirmed", "completed", "no_show"] as const;

/* ------------------------------- ranges -------------------------------- */

export const RANGE_PRESETS = [
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "ytd", label: "This year" },
  { key: "last_year", label: "Last year" },
] as const;

export type ReportRange = { from: string; to: string; preset: string | null };

const isDateKey = (s: unknown): s is string => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** ?preset= or ?from=&to= (inclusive local dates). Anything unusable falls back to the last 30 days. */
export function parseRange(q: Record<string, string | string[] | undefined>, now = new Date()): ReportRange {
  if (isDateKey(q.from) && isDateKey(q.to)) return q.from <= q.to ? { from: q.from, to: q.to, preset: null } : { from: q.to, to: q.from, preset: null };
  const today = todayKey(now);
  const year = today.slice(0, 4);
  const month = monthStartKey(today);
  switch (q.preset) {
    case "90d":
      return { from: addDaysKey(today, -89), to: today, preset: "90d" };
    case "this_month":
      return { from: month, to: today, preset: "this_month" };
    case "last_month":
      return { from: addMonthsKey(month, -1), to: addDaysKey(month, -1), preset: "last_month" };
    case "ytd":
      return { from: `${year}-01-01`, to: today, preset: "ytd" };
    case "last_year":
      return { from: `${Number(year) - 1}-01-01`, to: `${Number(year) - 1}-12-31`, preset: "last_year" };
    default:
      return { from: addDaysKey(today, -29), to: today, preset: "30d" };
  }
}

/* --------------------------- pure calculations -------------------------- */

export type Bar = { key: string; label: string; cents: number };

export function sumCash(entries: Pick<CashEntry, "cents">[]): number {
  return entries.reduce((n, e) => n + e.cents, 0);
}

/** Net cash per group, largest first. Refunds land on the booking's own experience and source. */
export function groupCash(entries: CashEntry[], keyOf: (e: CashEntry) => string, labelOf: (key: string) => string): Bar[] {
  const by = new Map<string, number>();
  for (const e of entries) by.set(keyOf(e), (by.get(keyOf(e)) ?? 0) + e.cents);
  return [...by].map(([key, cents]) => ({ key, label: labelOf(key), cents })).sort((a, b) => b.cents - a.cents);
}

/** Every month in the range, oldest first, including empty ones so gaps show. */
export function cashByMonth(entries: CashEntry[], from: string, to: string): Bar[] {
  const by = new Map<string, number>();
  for (const e of entries) {
    const k = fmt(e.at, "yyyy-MM");
    by.set(k, (by.get(k) ?? 0) + e.cents);
  }
  const out: Bar[] = [];
  for (let m = monthStartKey(from); m <= to; m = addMonthsKey(m, 1)) {
    out.push({ key: m.slice(0, 7), label: fmt(fromLocal(m, "12:00"), "MMM yyyy"), cents: by.get(m.slice(0, 7)) ?? 0 });
  }
  return out;
}

type Span = { start: Date; end: Date };

function merge(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const s of [...spans].sort((a, b) => a.start.getTime() - b.start.getTime())) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end) last.end = new Date(Math.max(last.end.getTime(), s.end.getTime()));
    else out.push({ ...s });
  }
  return out;
}

function overlapMs(start: number, end: number, merged: Span[]): number {
  let ms = 0;
  for (const s of merged) ms += Math.max(0, Math.min(end, s.end.getTime()) - Math.max(start, s.start.getTime()));
  return ms;
}

export type HeatCell = { weekday: number; hour: number; openHours: number; bookedHours: number };
export type Occupancy = { cells: HeatCell[]; openHours: number; bookedHours: number };

/**
 * Booked versus actually open hours by local weekday and hour. Open time is the
 * weekly hours minus blocks, so a day off never counts as an empty studio.
 * Bookings outside open time don't count (they'd push a cell past 100%).
 */
export function occupancyGrid(input: { open: Span[]; blocked: Span[]; booked: Span[] }): Occupancy {
  const blocked = merge(input.blocked);
  const busy = merge([...input.blocked, ...input.booked]);
  const cells = new Map<string, HeatCell>();
  for (const span of merge(input.open)) {
    // New York's UTC offset is a whole number of hours, so epoch hours are local hours.
    for (let t = span.start.getTime(); t < span.end.getTime(); ) {
      const end = Math.min(span.end.getTime(), (Math.floor(t / H) + 1) * H);
      const openMs = end - t - overlapMs(t, end, blocked);
      if (openMs > 0) {
        const local = new TZDate(t, TZ);
        const key = `${local.getDay()}|${local.getHours()}`;
        const c = cells.get(key) ?? { weekday: local.getDay(), hour: local.getHours(), openHours: 0, bookedHours: 0 };
        const blockedMs = end - t - openMs;
        c.openHours += openMs / H;
        c.bookedHours += (overlapMs(t, end, busy) - blockedMs) / H;
        cells.set(key, c);
      }
      t = end;
    }
  }
  const list = [...cells.values()];
  return {
    cells: list,
    openHours: list.reduce((n, c) => n + c.openHours, 0),
    bookedHours: list.reduce((n, c) => n + c.bookedHours, 0),
  };
}

const LEAD_BUCKETS = [
  { label: "Under a day", maxDays: 1 },
  { label: "1 to 3 days", maxDays: 4 },
  { label: "4 to 7 days", maxDays: 8 },
  { label: "8 to 14 days", maxDays: 15 },
  { label: "15 to 30 days", maxDays: 31 },
  { label: "More than 30 days", maxDays: Infinity },
];

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export type LeadTime = { count: number; medianDays: number | null; buckets: { label: string; count: number }[] };

export function leadTimeStats(rows: { createdAt: Date; startAt: Date }[]): LeadTime {
  const days = rows.map((r) => Math.max(0, r.startAt.getTime() - r.createdAt.getTime()) / DAY);
  const buckets = LEAD_BUCKETS.map((b) => ({ label: b.label, count: 0 }));
  for (const d of days) buckets[LEAD_BUCKETS.findIndex((b) => d < b.maxDays)].count++;
  return { count: days.length, medianDays: median(days), buckets };
}

export type Rates = { sessions: number; cancelled: number; cancelRate: number | null; started: number; noShows: number; noShowRate: number | null };

/** Cancellations are out of everything booked; no-shows are out of sessions that have started and weren't cancelled. */
export function bookingRates(rows: { status: string; startAt: Date }[], now: Date): Rates {
  const cancelled = rows.filter((r) => r.status === "cancelled").length;
  const started = rows.filter((r) => r.status !== "cancelled" && r.startAt <= now).length;
  const noShows = rows.filter((r) => r.status === "no_show").length;
  return {
    sessions: rows.length,
    cancelled,
    cancelRate: rows.length ? cancelled / rows.length : null,
    started,
    noShows,
    noShowRate: started ? noShows / started : null,
  };
}

export type Repeat = { guests: number; repeat: number; rate: number | null };

/** Share of guests in the range with two or more sessions so far. Placeholder addresses can't be matched, so they're left out. */
export function repeatGuests(inRangeEmails: string[], allSessionEmails: string[]): Repeat {
  const real = (e: string) => !e.endsWith(".invalid");
  const counts = new Map<string, number>();
  for (const e of allSessionEmails.filter(real)) counts.set(e, (counts.get(e) ?? 0) + 1);
  const guests = [...new Set(inRangeEmails.filter(real))];
  const repeat = guests.filter((g) => (counts.get(g) ?? 0) >= 2).length;
  return { guests: guests.length, repeat, rate: guests.length ? repeat / guests.length : null };
}

/** Booking value is what the guest committed, card plus gift card. Free and unpriced mirrors would drag it down, so they're skipped. */
export function averageValue(rows: { totalCents: number; giftCardCents: number }[]): { count: number; cents: number | null } {
  const values = rows.map((r) => r.totalCents + r.giftCardCents).filter((v) => v > 0);
  return { count: values.length, cents: values.length ? Math.round(values.reduce((n, v) => n + v, 0) / values.length) : null };
}

export type PromoLine = { code: string; uses: number; discountCents: number; revenueCents: number };

export function promoPerformance(rows: { code: string | null; discountCents: number; totalCents: number; giftCardCents: number }[]): PromoLine[] {
  const by = new Map<string, PromoLine>();
  for (const r of rows) {
    if (!r.code) continue;
    const p = by.get(r.code) ?? { code: r.code, uses: 0, discountCents: 0, revenueCents: 0 };
    p.uses++;
    p.discountCents += r.discountCents;
    p.revenueCents += r.totalCents + r.giftCardCents;
    by.set(r.code, p);
  }
  return [...by.values()].sort((a, b) => b.revenueCents - a.revenueCents);
}

export type Recovery = { sent: number; recovered: number; rate: number | null; revenueCents: number };

const RECOVERY_WINDOW = 7 * DAY;

/** A checkout counts as recovered when that guest books within 7 days of the email. Each later booking counts once. */
export function abandonedRecovery(
  sent: { email: string; sentAt: Date }[],
  later: { id: string; email: string; createdAt: Date; valueCents: number }[],
): Recovery {
  const used = new Set<string>();
  let revenueCents = 0;
  let recovered = 0;
  for (const s of [...sent].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())) {
    const hit = later
      .filter((b) => !used.has(b.id) && b.email === s.email && b.createdAt > s.sentAt && b.createdAt.getTime() - s.sentAt.getTime() <= RECOVERY_WINDOW)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    if (!hit) continue;
    used.add(hit.id);
    recovered++;
    revenueCents += hit.valueCents;
  }
  return { sent: sent.length, recovered, rate: sent.length ? recovered / sent.length : null, revenueCents };
}

export type SmartPricing = {
  netCents: number;
  addedCents: number;
  givenCents: number;
  bookings: number;
  rules: { name: string; bookings: number; cents: number }[];
};

export function smartPricingImpact(rows: { priceAdjustCents: number; priceRuleName: string | null }[]): SmartPricing {
  const hits = rows.filter((r) => r.priceAdjustCents !== 0);
  const by = new Map<string, { name: string; bookings: number; cents: number }>();
  for (const r of hits) {
    const name = r.priceRuleName ?? "Removed rule";
    const x = by.get(name) ?? { name, bookings: 0, cents: 0 };
    x.bookings++;
    x.cents += r.priceAdjustCents;
    by.set(name, x);
  }
  return {
    netCents: hits.reduce((n, r) => n + r.priceAdjustCents, 0),
    addedCents: hits.reduce((n, r) => n + Math.max(0, r.priceAdjustCents), 0),
    givenCents: hits.reduce((n, r) => n + Math.max(0, -r.priceAdjustCents), 0),
    bookings: hits.length,
    rules: [...by.values()].sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents)),
  };
}

/* ------------------------------- queries -------------------------------- */

/** Weekly hours as real spans on each date. Experiences sharing a calendar merge, so overlapping hours count once. */
export function openSpans(exps: Pick<Experience, "schedule">[], from: string, to: string): Span[] {
  const out: Span[] = [];
  for (const dateKey of dateRange(from, to)) {
    const weekday = String(weekdayOf(dateKey));
    for (const e of exps) for (const w of e.schedule[weekday] ?? []) out.push({ start: fromLocal(dateKey, w.start), end: fromLocal(dateKey, w.end) });
  }
  return out;
}

// shortcut: treats every experience as one shared calendar (true for one host), split by resourceGroup if a second host joins.
async function getOccupancy(from: string, to: string, fromAt: Date, toAt: Date): Promise<Occupancy> {
  const db = await getDb();
  const [exps, blocked, booked] = await Promise.all([
    db.select({ schedule: experiences.schedule }).from(experiences).where(eq(experiences.active, true)),
    db.select({ start: blocks.startAt, end: blocks.endAt }).from(blocks).where(and(lt(blocks.startAt, toAt), gt(blocks.endAt, fromAt))),
    db
      .select({ start: bookings.startAt, end: bookings.endAt })
      .from(bookings)
      .where(and(inArray(bookings.status, [...LIVE]), lt(bookings.startAt, toAt), gt(bookings.endAt, fromAt))),
  ]);
  return occupancyGrid({ open: openSpans(exps, from, to), blocked, booked });
}

export type GiftCardSummary = { soldCents: number; soldCount: number; redeemedCents: number; outstandingCents: number };

export type Report = {
  range: ReportRange;
  revenue: { totalCents: number; sessionCents: number; giftCardCents: number; refundCents: number; byExperience: Bar[]; bySource: Bar[]; byMonth: Bar[] };
  occupancy: Occupancy;
  leadTime: LeadTime;
  rates: Rates;
  repeat: Repeat;
  average: { count: number; cents: number | null };
  giftCards: GiftCardSummary;
  promos: PromoLine[];
  abandoned: Recovery & { expired: number };
  smartPricing: SmartPricing;
};

export async function getReport(range: ReportRange, now = new Date()): Promise<Report> {
  const db = await getDb();
  const fromAt = fromLocal(range.from);
  const toAt = fromLocal(addDaysKey(range.to, 1));
  const inRange = and(gte(bookings.startAt, fromAt), lt(bookings.startAt, toAt));

  const [entries, sessions, expNames, occupancy, allEmails, redeemed, outstanding, sentRows, expired] = await Promise.all([
    getCashEntries(fromAt, toAt),
    db
      .select({
        status: bookings.status,
        source: bookings.source,
        startAt: bookings.startAt,
        createdAt: bookings.createdAt,
        email: sql<string>`lower(${bookings.contactEmail})`,
        totalCents: bookings.totalCents,
        giftCardCents: bookings.giftCardCents,
        discountCents: bookings.discountCents,
        priceAdjustCents: bookings.priceAdjustCents,
        priceRuleName: bookings.priceRuleName,
        code: promoCodes.code,
      })
      .from(bookings)
      .leftJoin(promoCodes, eq(promoCodes.id, bookings.promoCodeId))
      .where(and(inRange, inArray(bookings.status, ["confirmed", "completed", "no_show", "cancelled"]))),
    db.select({ id: experiences.id, name: experiences.shortName }).from(experiences).orderBy(asc(experiences.sortOrder)),
    getOccupancy(range.from, range.to, fromAt, toAt),
    db
      .select({ email: sql<string>`lower(${bookings.contactEmail})` })
      .from(bookings)
      .where(and(inArray(bookings.status, [...LIVE]), lt(bookings.startAt, toAt))),
    db
      .select({ cents: sql<number>`coalesce(-sum(${giftCardTransactions.amountCents}), 0)::int` })
      .from(giftCardTransactions)
      .where(and(isNotNull(giftCardTransactions.bookingId), gte(giftCardTransactions.createdAt, fromAt), lt(giftCardTransactions.createdAt, toAt))),
    db.select({ cents: sql<number>`coalesce(sum(${giftCards.balanceCents}), 0)::int` }).from(giftCards).where(eq(giftCards.status, "active")),
    db
      .select({ email: sql<string>`lower(${bookings.contactEmail})`, sentAt: bookings.abandonedEmailSentAt })
      .from(bookings)
      .where(and(gte(bookings.abandonedEmailSentAt, fromAt), lt(bookings.abandonedEmailSentAt, toAt))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(eq(bookings.status, "expired"), eq(bookings.source, "direct"), gte(bookings.createdAt, fromAt), lt(bookings.createdAt, toAt))),
  ]);

  const emails = [...new Set(sentRows.map((r) => r.email))];
  const later = emails.length
    ? await db
        .select({
          id: bookings.id,
          email: sql<string>`lower(${bookings.contactEmail})`,
          createdAt: bookings.createdAt,
          totalCents: bookings.totalCents,
          giftCardCents: bookings.giftCardCents,
        })
        .from(bookings)
        .where(and(inArray(sql`lower(${bookings.contactEmail})`, emails), inArray(bookings.status, [...LIVE]), gte(bookings.createdAt, fromAt)))
    : [];

  const live = sessions.filter((s) => s.status !== "cancelled");
  const name = (id: string) => expNames.find((e) => e.id === id)?.name ?? "Removed experience";
  const cards = entries.filter((e) => e.kind === "gift_card");

  return {
    range,
    revenue: {
      totalCents: sumCash(entries),
      sessionCents: sumCash(entries.filter((e) => e.kind === "booking")),
      giftCardCents: sumCash(cards),
      refundCents: -sumCash(entries.filter((e) => e.kind === "refund")),
      byExperience: groupCash(entries, (e) => e.experienceId ?? "gift_cards", (k) => (k === "gift_cards" ? "Gift cards sold" : name(k))),
      bySource: groupCash(entries, (e) => e.source ?? "gift_cards", (k) => (k === "gift_cards" ? "Gift cards sold" : (SOURCE_LABEL[k as keyof typeof SOURCE_LABEL] ?? k))),
      byMonth: cashByMonth(entries, range.from, range.to),
    },
    occupancy,
    // Hand-entered bookings are created after the fact, so only self-serve ones show a true lead time.
    leadTime: leadTimeStats(live.filter((s) => s.source === "direct" || s.source === "cal")),
    rates: bookingRates(sessions, now),
    repeat: repeatGuests(live.map((s) => s.email), allEmails.map((r) => r.email)),
    average: averageValue(live),
    giftCards: { soldCents: sumCash(cards), soldCount: cards.length, redeemedCents: Number(redeemed[0]?.cents ?? 0), outstandingCents: Number(outstanding[0]?.cents ?? 0) },
    promos: promoPerformance(live),
    abandoned: {
      ...abandonedRecovery(
        sentRows.map((r) => ({ email: r.email, sentAt: new Date(r.sentAt!) })),
        later.map((b) => ({ id: b.id, email: b.email, createdAt: b.createdAt, valueCents: b.totalCents + b.giftCardCents })),
      ),
      expired: Number(expired[0]?.n ?? 0),
    },
    smartPricing: smartPricingImpact(live),
  };
}

/* --------------------------------- CSV ---------------------------------- */

const dollars = (cents: number) => Number((cents / 100).toFixed(2));
const percent = (rate: number | null) => (rate === null ? null : Math.round(rate * 1000) / 10);

/** One flat sheet: Section, Item, Value, Unit. Numbers stay numbers so spreadsheets can add them up. */
export function reportCsvRows(r: Report): (string | number | null)[][] {
  const money = (section: string, item: string, cents: number) => [section, item, dollars(cents), "USD"];
  const count = (section: string, item: string, n: number | null, unit = "count") => [section, item, n, unit];
  return [
    money("Revenue", "Net cash revenue", r.revenue.totalCents),
    money("Revenue", "Session payments", r.revenue.sessionCents),
    money("Revenue", "Gift cards sold", r.revenue.giftCardCents),
    money("Revenue", "Refunds", -r.revenue.refundCents),
    ...r.revenue.byExperience.map((b) => money("Revenue by experience", b.label, b.cents)),
    ...r.revenue.bySource.map((b) => money("Revenue by source", b.label, b.cents)),
    ...r.revenue.byMonth.map((b) => money("Revenue by month", b.label, b.cents)),
    count("Occupancy", "Open hours", Math.round(r.occupancy.openHours * 10) / 10, "hours"),
    count("Occupancy", "Booked hours", Math.round(r.occupancy.bookedHours * 10) / 10, "hours"),
    ...r.occupancy.cells
      .slice()
      .sort((a, b) => a.weekday - b.weekday || a.hour - b.hour)
      .map((c) => count("Occupancy by slot", `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][c.weekday]} ${String(c.hour).padStart(2, "0")}:00`, percent(c.bookedHours / c.openHours), "percent")),
    count("Lead time", "Median days ahead", r.leadTime.medianDays === null ? null : Math.round(r.leadTime.medianDays * 10) / 10, "days"),
    ...r.leadTime.buckets.map((b) => count("Lead time", b.label, b.count)),
    count("Bookings", "Sessions booked", r.rates.sessions),
    count("Bookings", "Cancelled", r.rates.cancelled),
    count("Bookings", "Cancellation rate", percent(r.rates.cancelRate), "percent"),
    count("Bookings", "No-shows", r.rates.noShows),
    count("Bookings", "No-show rate", percent(r.rates.noShowRate), "percent"),
    count("Guests", "Guests", r.repeat.guests),
    count("Guests", "Repeat guests", r.repeat.repeat),
    count("Guests", "Repeat guest rate", percent(r.repeat.rate), "percent"),
    money("Bookings", "Average booking value", r.average.cents ?? 0),
    money("Gift cards", "Sold", r.giftCards.soldCents),
    money("Gift cards", "Redeemed", r.giftCards.redeemedCents),
    money("Gift cards", "Outstanding today", r.giftCards.outstandingCents),
    ...r.promos.flatMap((p) => [count("Promos", `${p.code} uses`, p.uses), money("Promos", `${p.code} discount given`, p.discountCents), money("Promos", `${p.code} booking value`, p.revenueCents)]),
    count("Abandoned checkouts", "Checkouts abandoned", r.abandoned.expired),
    count("Abandoned checkouts", "Recovery emails sent", r.abandoned.sent),
    count("Abandoned checkouts", "Recovered", r.abandoned.recovered),
    money("Abandoned checkouts", "Recovered booking value", r.abandoned.revenueCents),
    money("Smart pricing", "Net change", r.smartPricing.netCents),
    money("Smart pricing", "Added by higher prices", r.smartPricing.addedCents),
    money("Smart pricing", "Given in lower prices", -r.smartPricing.givenCents),
    ...r.smartPricing.rules.map((x) => money("Smart pricing by rule", x.name, x.cents)),
  ];
}
