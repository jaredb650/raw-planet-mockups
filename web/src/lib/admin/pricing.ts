/**
 * Smart pricing insights: how each weekly slot has really filled, the
 * suggestions built on that, and the "what guests will pay" grid.
 */
import "server-only";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { blocks, bookings, experiences, type Experience, type PricingRule } from "@/lib/db/schema";
import { computeDaySlots, loadPriceRules } from "@/lib/booking/availability";
import { adjustedCents, pickPriceRule } from "@/lib/booking/pricing";
import { addDaysKey, fmt, fmtTime, fromLocal, overlaps, todayKey, weekdayOf } from "@/lib/time";
import { median } from "./reports";

const DAY = 86400_000;
export const HISTORY_DAYS = 90;
export const MIN_BOOKINGS = 12;
export const MIN_OPEN_WEEKS = 8;
export const QUIET_RATE = 0.15;
export const BUSY_RATE = 0.75;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type SlotExperience = Pick<Experience, "id" | "schedule" | "slotStepMinutes" | "bufferMinutes" | "leadTimeHours" | "maxAdvanceDays" | "durationOptions">;
type Span = { start: Date; end: Date };

/** Every start time an experience offers on a date, ignoring bookings and notice. Shortest session gives the fullest list. */
export function offeredSlots(e: SlotExperience, dateKey: string, durationMinutes = Math.min(...e.durationOptions.map((o) => o.minutes))) {
  const open = { ...e, leadTimeHours: 0, maxAdvanceDays: 365_000 };
  return computeDaySlots({ experience: open, dateKey, durationMinutes, busy: [], now: new Date(0) }).slots;
}

export type SlotStat = { weekday: number; time: string; stepMinutes: number; open: number; taken: number; leadDays: number | null; experienceIds: string[] };

/**
 * For each weekly slot: how many past dates it was really open (blocked days
 * don't count) and how many of those it was taken. Taken means any session
 * overlapped it, because one host means one calendar.
 */
export function slotStats(input: {
  experiences: SlotExperience[];
  dates: string[];
  /** selfServedAt: when the guest booked it themselves. Hand-entered bookings have no true lead time. */
  booked: (Span & { selfServedAt: Date | null })[];
  blocked: Span[];
}): SlotStat[] {
  const seen = new Map<string, { stat: SlotStat; dates: Set<string>; leads: number[] }>();
  for (const dateKey of input.dates) {
    for (const e of input.experiences) {
      for (const s of offeredSlots(e, dateKey)) {
        const start = new Date(s.start);
        const end = new Date(s.end);
        if (input.blocked.some((b) => overlaps(start, end, b.start, b.end))) continue;
        const weekday = weekdayOf(dateKey);
        const time = fmt(start, "HH:mm");
        const key = `${weekday}|${time}`;
        const row = seen.get(key) ?? {
          stat: { weekday, time, stepMinutes: e.slotStepMinutes, open: 0, taken: 0, leadDays: null, experienceIds: [] },
          dates: new Set<string>(),
          leads: [],
        };
        if (!row.stat.experienceIds.includes(e.id)) row.stat.experienceIds.push(e.id);
        if (!row.dates.has(dateKey)) {
          row.dates.add(dateKey);
          row.stat.open++;
          if (input.booked.some((b) => overlaps(start, end, b.start, b.end))) row.stat.taken++;
          for (const b of input.booked) if (b.selfServedAt && b.start.getTime() === start.getTime()) row.leads.push((b.start.getTime() - b.selfServedAt.getTime()) / DAY);
        }
        seen.set(key, row);
      }
    }
  }
  return [...seen.values()].map(({ stat, leads }) => ({ ...stat, leadDays: median(leads) }));
}

export type RulePrefill = { name: string; experienceIds: string[]; weekday: number; startTime: string; endTime: string; adjustPercent: number };
export type Suggestion = { kind: "quiet" | "busy"; title: string; evidence: string; prefill: RulePrefill };
export type Suggestions = { enoughData: boolean; bookings: number; days: number; items: Suggestion[] };

const addMinutes = (time: string, minutes: number) => {
  const [h, m] = time.split(":").map(Number);
  const t = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/** Plain, checkable suggestions. Never more than three of each kind, and never for a slot a rule already covers. */
export function suggestRules(stats: SlotStat[], opts: { bookings: number; days: number; covered: (s: SlotStat) => boolean }): Suggestions {
  const { bookings: count, days } = opts;
  const out: Suggestions = { enoughData: count >= MIN_BOOKINGS, bookings: count, days, items: [] };
  if (!out.enoughData) return out;
  const rate = (s: SlotStat) => s.taken / s.open;
  const usable = stats.filter((s) => s.open >= MIN_OPEN_WEEKS && !opts.covered(s));
  const typicalLead = median(stats.flatMap((s) => (s.leadDays === null ? [] : [s.leadDays])));
  const label = (s: SlotStat) => `${WEEKDAYS[s.weekday]} ${fmtTime(fromLocal("2026-01-05", s.time))}`;
  const describe = (s: SlotStat) => `Taken on ${s.taken} of the last ${s.open} open ${WEEKDAYS[s.weekday]}s (${Math.round(rate(s) * 100)}%).`;
  const prefill = (s: SlotStat, name: string, adjustPercent: number): RulePrefill => ({
    name,
    experienceIds: s.experienceIds,
    weekday: s.weekday,
    startTime: s.time,
    endTime: addMinutes(s.time, Math.max(15, s.stepMinutes)),
    adjustPercent,
  });

  const quiet = usable.filter((s) => rate(s) <= QUIET_RATE).sort((a, b) => rate(a) - rate(b) || a.weekday - b.weekday).slice(0, 3);
  const busy = usable.filter((s) => rate(s) >= BUSY_RATE).sort((a, b) => rate(b) - rate(a) || a.weekday - b.weekday).slice(0, 3);
  for (const s of busy) {
    const lead =
      s.leadDays !== null && typicalLead !== null && Math.round(s.leadDays) > Math.round(typicalLead)
        ? ` Usually booked ${Math.round(s.leadDays)} days ahead, against ${Math.round(typicalLead)} for a typical slot.`
        : "";
    out.items.push({
      kind: "busy",
      title: `${label(s)} fills up. You could charge a little more.`,
      evidence: describe(s) + lead,
      prefill: prefill(s, `${label(s)} peak`, 10),
    });
  }
  for (const s of quiet)
    out.items.push({
      kind: "quiet",
      title: `${label(s)} rarely fills. An off-peak price may help.`,
      evidence: describe(s),
      prefill: prefill(s, `${label(s)} off-peak`, -15),
    });
  return out;
}

/** The last 90 days of real history, or less for a young business: days before the first booking say nothing about demand. */
export async function loadSlotHistory(now = new Date()) {
  const db = await getDb();
  const today = todayKey(now);
  const windowFrom = fromLocal(addDaysKey(today, -HISTORY_DAYS));
  const yesterdayEnd = fromLocal(today);
  const [exps, sessions, blockRows, rules] = await Promise.all([
    db.select().from(experiences).where(eq(experiences.active, true)).orderBy(asc(experiences.sortOrder)),
    db
      .select({ start: bookings.startAt, end: bookings.endAt, createdAt: bookings.createdAt, source: bookings.source })
      .from(bookings)
      .where(and(inArray(bookings.status, ["confirmed", "completed", "no_show"]), gte(bookings.startAt, windowFrom), lt(bookings.startAt, yesterdayEnd))),
    db.select({ start: blocks.startAt, end: blocks.endAt }).from(blocks).where(and(lt(blocks.startAt, yesterdayEnd), gte(blocks.endAt, windowFrom))),
    loadPriceRules(db),
  ]);
  const first = sessions.reduce<Date | null>((min, s) => (!min || s.start < min ? s.start : min), null);
  const dates: string[] = [];
  if (first) for (let k = fmt(first, "yyyy-MM-dd"); k < today; k = addDaysKey(k, 1)) dates.push(k);
  const booked = sessions.map((s) => ({ ...s, selfServedAt: s.source === "direct" || s.source === "cal" ? s.createdAt : null }));
  const stats = slotStats({ experiences: exps, dates, booked, blocked: blockRows });
  return { exps, rules, stats, bookings: sessions.length, days: dates.length };
}

export async function getSuggestions(now = new Date()): Promise<Suggestions> {
  const { rules, stats, bookings: count, days } = await loadSlotHistory(now);
  // Probing two weeks out keeps last-minute rules from hiding a slot they don't really cover.
  const nextDate = (weekday: number) => {
    let k = addDaysKey(todayKey(now), 14);
    while (weekdayOf(k) !== weekday) k = addDaysKey(k, 1);
    return k;
  };
  const covered = (s: SlotStat) => s.experienceIds.some((id) => pickPriceRule(rules, id, fromLocal(nextDate(s.weekday), s.time), now));
  return suggestRules(stats, { bookings: count, days, covered });
}

export type RuleInput = {
  name: string;
  adjustPercent: number;
  weekdays: number[] | null;
  startTime: string | null;
  endTime: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  minHoursAhead: number | null;
  maxHoursAhead: number | null;
};

/** The first problem with a rule, in the owner's words, or null when it can be saved. */
export function ruleProblem(r: RuleInput): string | null {
  if (r.name.length < 2) return "Give the rule a name.";
  if (!Number.isInteger(r.adjustPercent) || r.adjustPercent < -50 || r.adjustPercent > 50 || r.adjustPercent === 0)
    return "The price change must be a whole percent between -50 and +50, and not 0.";
  if (r.weekdays?.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return "Pick days from the list.";
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  if ((r.startTime && !time.test(r.startTime)) || (r.endTime && !time.test(r.endTime))) return "Times need to look like 14:00.";
  if (r.startTime && r.endTime && r.startTime >= r.endTime) return "The time window has to end after it starts, on the same day.";
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if ((r.dateFrom && !date.test(r.dateFrom)) || (r.dateTo && !date.test(r.dateTo))) return "Pick dates from the calendar.";
  if (r.dateFrom && r.dateTo && r.dateFrom > r.dateTo) return "The end date is before the start date.";
  if ((r.minHoursAhead ?? 0) < 0 || (r.maxHoursAhead ?? 0) < 0) return "Hours ahead can't be negative.";
  if (r.minHoursAhead != null && r.maxHoursAhead != null && r.minHoursAhead > r.maxHoursAhead) return "The minimum hours ahead is above the maximum.";
  const unconditional = !r.weekdays?.length && !r.startTime && !r.endTime && !r.dateFrom && !r.dateTo && r.minHoursAhead == null && r.maxHoursAhead == null;
  // It would make every "from $X" on the site untrue.
  if (unconditional && r.adjustPercent > 0) return "This would raise every price, every day. Change the price on the experience instead, or add a day, time or date.";
  return null;
}

export type GridCell = { cents: number; adjustPercent: number } | null;
export type WeekGrid = { dates: string[]; times: string[]; cells: Record<string, GridCell> };

/** What a guest booking now would pay for one unit (a guest, or a session before extra guests) on each slot of a week. */
export function weekGrid(e: SlotExperience, rules: PricingRule[], weekStart: string, durationMinutes: number, now: Date): WeekGrid {
  const dates = Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i));
  const unit = e.durationOptions.find((o) => o.minutes === durationMinutes)?.priceCents ?? 0;
  const cells: WeekGrid["cells"] = {};
  const times = new Set<string>();
  for (const dateKey of dates) {
    for (const s of offeredSlots(e, dateKey, durationMinutes)) {
      const start = new Date(s.start);
      const time = fmt(start, "HH:mm");
      const adjustPercent = pickPriceRule(rules, e.id, start, now)?.adjustPercent ?? 0;
      times.add(time);
      cells[`${dateKey}|${time}`] = { cents: adjustedCents(unit, adjustPercent), adjustPercent };
    }
  }
  return { dates, times: [...times].sort(), cells };
}
