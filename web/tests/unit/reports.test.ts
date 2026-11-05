import { describe, expect, it } from "vitest";
import {
  abandonedRecovery, averageValue, bookingRates, cashByMonth, groupCash, leadTimeStats, median, occupancyGrid, openSpans, parseRange,
  promoPerformance, repeatGuests, reportCsvRows, smartPricingImpact, sumCash, type Report,
} from "@/lib/admin/reports";
import { ruleProblem, slotStats, suggestRules, weekGrid, type RuleInput, type SlotStat } from "@/lib/admin/pricing";
import { weeklyReportDue } from "@/lib/automation/rules";
import { addDaysKey, dateRange, fromLocal } from "@/lib/time";
import type { CashEntry } from "@/lib/admin/dashboard";
import type { PricingRule } from "@/lib/db/schema";

const entry = (cents: number, over: Partial<CashEntry> = {}): CashEntry => ({ at: new Date("2026-05-15T16:00:00Z"), cents, kind: "booking", experienceId: "a", source: "direct", ...over });

describe("revenue", () => {
  const entries = [entry(30000), entry(20000, { experienceId: "b", source: "airbnb" }), entry(-5000, { kind: "refund" }), entry(10000, { kind: "gift_card", experienceId: null, source: null })];
  it("nets refunds against the booking's own experience and source", () => {
    expect(sumCash(entries)).toBe(55000);
    const byExp = groupCash(entries, (e) => e.experienceId ?? "gift", (k) => k);
    expect(byExp).toEqual([
      { key: "a", label: "a", cents: 25000 },
      { key: "b", label: "b", cents: 20000 },
      { key: "gift", label: "gift", cents: 10000 },
    ]);
  });
  it("buckets months in New York time and keeps empty months", () => {
    const newYearsEve = entry(100, { at: new Date("2027-01-01T03:00:00Z") }); // still Dec 31 in New York
    const bars = cashByMonth([newYearsEve], "2026-11-15", "2027-01-10");
    expect(bars.map((b) => [b.key, b.cents])).toEqual([["2026-11", 0], ["2026-12", 100], ["2027-01", 0]]);
  });
});

describe("parseRange", () => {
  const now = new Date("2026-11-04T17:00:00Z");
  it("defaults to the last 30 days, inclusive", () => {
    expect(parseRange({}, now)).toEqual({ from: "2026-10-06", to: "2026-11-04", preset: "30d" });
  });
  it("reads presets", () => {
    expect(parseRange({ preset: "last_month" }, now)).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(parseRange({ preset: "last_year" }, now)).toMatchObject({ from: "2025-01-01", to: "2025-12-31" });
  });
  it("takes custom dates, swaps reversed ones and ignores nonsense", () => {
    expect(parseRange({ from: "2026-02-01", to: "2026-01-01" }, now)).toEqual({ from: "2026-01-01", to: "2026-02-01", preset: null });
    expect(parseRange({ from: "2026-02-31", to: "2026-03-01" }, now).preset).toBe("30d");
  });
});

describe("occupancyGrid", () => {
  const span = (date: string, a: string, b: string) => ({ start: fromLocal(date, a), end: fromLocal(date, b) });
  const MON = "2026-06-01";
  it("compares booked with open hours per weekday and hour", () => {
    const g = occupancyGrid({ open: [span(MON, "10:00", "12:00")], blocked: [], booked: [span(MON, "10:30", "11:00")] });
    expect(g.cells).toEqual([
      { weekday: 1, hour: 10, openHours: 1, bookedHours: 0.5 },
      { weekday: 1, hour: 11, openHours: 1, bookedHours: 0 },
    ]);
  });
  it("takes blocked time out of what was available", () => {
    const g = occupancyGrid({ open: [span(MON, "10:00", "12:00")], blocked: [span(MON, "11:00", "12:00")], booked: [span(MON, "10:00", "12:00")] });
    expect(g.openHours).toBe(1);
    expect(g.bookedHours).toBe(1);
  });
  it("counts overlapping schedules and double bookings once, and ignores sessions outside open hours", () => {
    const g = occupancyGrid({
      open: [span(MON, "10:00", "12:00"), span(MON, "11:00", "13:00")],
      blocked: [],
      booked: [span(MON, "10:00", "11:00"), span(MON, "10:00", "11:00"), span(MON, "20:00", "21:00")],
    });
    expect(g.openHours).toBe(3);
    expect(g.bookedHours).toBe(1);
  });
  it("adds weeks up in the same cell, on local hours across DST", () => {
    const open = openSpans([{ schedule: { "0": [{ start: "14:00", end: "15:00" }] } } as never], "2026-10-25", "2026-11-01");
    const g = occupancyGrid({ open, blocked: [], booked: [span("2026-11-01", "14:00", "15:00")] });
    expect(g.cells).toEqual([{ weekday: 0, hour: 14, openHours: 2, bookedHours: 1 }]);
  });
});

describe("lead time", () => {
  it("finds the median and buckets by days ahead", () => {
    const start = new Date("2026-06-20T12:00:00Z");
    const ago = (days: number) => ({ startAt: start, createdAt: new Date(start.getTime() - days * 86400_000) });
    const s = leadTimeStats([ago(0.5), ago(2), ago(10), ago(40)]);
    expect(s.medianDays).toBe(6);
    expect(s.buckets.map((b) => b.count)).toEqual([1, 1, 0, 1, 0, 1]);
  });
  it("copes with no data", () => {
    expect(leadTimeStats([]).medianDays).toBeNull();
    expect(median([])).toBeNull();
  });
});

describe("rates", () => {
  const now = new Date("2026-06-10T00:00:00Z");
  const past = new Date("2026-06-01T00:00:00Z");
  const future = new Date("2026-06-20T00:00:00Z");
  it("uses the right denominator for each", () => {
    const r = bookingRates(
      [
        { status: "completed", startAt: past }, { status: "completed", startAt: past }, { status: "no_show", startAt: past },
        { status: "cancelled", startAt: past }, { status: "confirmed", startAt: future },
      ],
      now,
    );
    expect(r.cancelRate).toBe(1 / 5);
    expect(r.started).toBe(3);
    expect(r.noShowRate).toBe(1 / 3);
  });
  it("is null, not 0, with nothing to measure", () => {
    expect(bookingRates([], now)).toMatchObject({ cancelRate: null, noShowRate: null });
  });
});

describe("guests and values", () => {
  it("counts a guest as repeat with two sessions so far, and skips placeholder addresses", () => {
    const r = repeatGuests(["a@x.com", "a@x.com", "b@x.com", "no-email+1@rawplanet.invalid"], ["a@x.com", "a@x.com", "b@x.com", "no-email+1@rawplanet.invalid", "no-email+1@rawplanet.invalid"]);
    expect(r).toEqual({ guests: 2, repeat: 1, rate: 0.5 });
  });
  it("averages card plus gift card over paid sessions only", () => {
    expect(averageValue([{ totalCents: 10000, giftCardCents: 5000 }, { totalCents: 0, giftCardCents: 5000 }, { totalCents: 0, giftCardCents: 0 }])).toEqual({ count: 2, cents: 10000 });
    expect(averageValue([]).cents).toBeNull();
  });
  it("adds up promos by code", () => {
    const rows = [
      { code: "TEN", discountCents: 1000, totalCents: 9000, giftCardCents: 0 },
      { code: "TEN", discountCents: 500, totalCents: 4000, giftCardCents: 500 },
      { code: null, discountCents: 0, totalCents: 15000, giftCardCents: 0 },
    ];
    expect(promoPerformance(rows)).toEqual([{ code: "TEN", uses: 2, discountCents: 1500, revenueCents: 13500 }]);
  });
});

describe("abandonedRecovery", () => {
  const sentAt = new Date("2026-06-01T12:00:00Z");
  const later = (id: string, days: number, email = "a@x.com") => ({ id, email, createdAt: new Date(sentAt.getTime() + days * 86400_000), valueCents: 15000 });
  it("counts a booking within 7 days of the email", () => {
    expect(abandonedRecovery([{ email: "a@x.com", sentAt }], [later("1", 2)])).toEqual({ sent: 1, recovered: 1, rate: 1, revenueCents: 15000 });
  });
  it("ignores bookings before the email, after 7 days, or by someone else", () => {
    expect(abandonedRecovery([{ email: "a@x.com", sentAt }], [later("1", -1), later("2", 8), later("3", 1, "b@x.com")]).recovered).toBe(0);
  });
  it("never counts one booking twice", () => {
    const r = abandonedRecovery([{ email: "a@x.com", sentAt }, { email: "a@x.com", sentAt: new Date(sentAt.getTime() + 3600_000) }], [later("1", 1)]);
    expect(r.recovered).toBe(1);
    expect(r.rate).toBe(0.5);
  });
});

describe("smartPricingImpact", () => {
  it("sums priceAdjustCents and splits it by direction and rule", () => {
    const s = smartPricingImpact([
      { priceAdjustCents: 2300, priceRuleName: "Peak" }, { priceAdjustCents: 2300, priceRuleName: "Peak" },
      { priceAdjustCents: -3000, priceRuleName: "Quiet" }, { priceAdjustCents: 0, priceRuleName: null },
    ]);
    expect(s).toMatchObject({ netCents: 1600, addedCents: 4600, givenCents: 3000, bookings: 3 });
    expect(s.rules[0]).toEqual({ name: "Peak", bookings: 2, cents: 4600 });
  });
});

describe("reportCsvRows", () => {
  it("keeps refunds negative and money as plain dollars", () => {
    const zero = { totalCents: 12345, sessionCents: 0, giftCardCents: 0, refundCents: 500, byExperience: [], bySource: [], byMonth: [] };
    const report = {
      revenue: zero, occupancy: { cells: [], openHours: 0, bookedHours: 0 }, leadTime: { count: 0, medianDays: null, buckets: [] },
      rates: { sessions: 0, cancelled: 0, cancelRate: null, started: 0, noShows: 0, noShowRate: null }, repeat: { guests: 0, repeat: 0, rate: null },
      average: { count: 0, cents: null }, giftCards: { soldCents: 0, soldCount: 0, redeemedCents: 0, outstandingCents: 0 }, promos: [],
      abandoned: { sent: 0, recovered: 0, rate: null, revenueCents: 0, expired: 0 }, smartPricing: smartPricingImpact([]),
    } as unknown as Report;
    const rows = reportCsvRows(report);
    expect(rows[0]).toEqual(["Revenue", "Net cash revenue", 123.45, "USD"]);
    expect(rows.find((r) => r[1] === "Refunds")?.[2]).toBe(-5);
  });
});

const exp = {
  id: "e1", schedule: { "2": [{ start: "10:00", end: "14:00" }] }, slotStepMinutes: 120, bufferMinutes: 0, leadTimeHours: 0, maxAdvanceDays: 60,
  durationOptions: [{ minutes: 120, priceCents: 15000 }],
};

describe("slotStats", () => {
  const dates = dateRange("2026-06-01", "2026-06-30"); // Tuesdays: 2, 9, 16, 23, 30
  const session = (date: string, time: string) => ({ start: fromLocal(date, time), end: new Date(fromLocal(date, time).getTime() + 2 * 3600_000), selfServedAt: new Date(fromLocal(date, time).getTime() - 5 * 86400_000) });
  it("counts open dates and how many were taken", () => {
    const stats = slotStats({ experiences: [exp], dates, booked: [session("2026-06-02", "10:00"), session("2026-06-09", "10:00")], blocked: [] });
    expect(stats.find((s) => s.time === "10:00")).toMatchObject({ weekday: 2, open: 5, taken: 2, leadDays: 5 });
    expect(stats.find((s) => s.time === "12:00")).toMatchObject({ open: 5, taken: 0, leadDays: null });
  });
  it("leaves hand-entered bookings out of lead time, but still counts them as taken", () => {
    const stats = slotStats({ experiences: [exp], dates, booked: [{ ...session("2026-06-02", "10:00"), selfServedAt: null }], blocked: [] });
    expect(stats.find((s) => s.time === "10:00")).toMatchObject({ taken: 1, leadDays: null });
  });
  it("doesn't count a blocked day as an empty slot", () => {
    const stats = slotStats({ experiences: [exp], dates, booked: [], blocked: [{ start: fromLocal("2026-06-02"), end: fromLocal("2026-06-03") }] });
    expect(stats.find((s) => s.time === "10:00")?.open).toBe(4);
  });
  it("counts a date once when two experiences offer the same time", () => {
    const stats = slotStats({ experiences: [exp, { ...exp, id: "e2" }], dates, booked: [], blocked: [] });
    expect(stats.find((s) => s.time === "10:00")).toMatchObject({ open: 5, experienceIds: ["e1", "e2"] });
  });
});

describe("suggestRules", () => {
  const stat = (over: Partial<SlotStat>): SlotStat => ({ weekday: 2, time: "10:00", stepMinutes: 120, open: 12, taken: 6, leadDays: 5, experienceIds: ["e1"], ...over });
  const none = { covered: () => false, days: 90 };
  it("says so plainly when there is too little data", () => {
    const r = suggestRules([stat({ taken: 0 })], { ...none, bookings: 11 });
    expect(r.enoughData).toBe(false);
    expect(r.items).toEqual([]);
  });
  it("states the numbers behind a quiet slot and prefills a discount", () => {
    const [s] = suggestRules([stat({ taken: 1 })], { ...none, bookings: 30 }).items;
    expect(s.kind).toBe("quiet");
    expect(s.evidence).toBe("Taken on 1 of the last 12 open Tuesdays (8%).");
    expect(s.prefill).toMatchObject({ weekday: 2, startTime: "10:00", endTime: "12:00", adjustPercent: -15, experienceIds: ["e1"] });
  });
  it("flags a slot that fills first, with its lead time against the typical one", () => {
    const stats = [stat({ weekday: 6, time: "14:00", taken: 11, leadDays: 14 }), stat({ leadDays: 4 }), stat({ time: "12:00", leadDays: 4 })];
    const [s] = suggestRules(stats, { ...none, bookings: 30 }).items;
    expect(s.kind).toBe("busy");
    expect(s.evidence).toContain("Taken on 11 of the last 12 open Saturdays (92%).");
    expect(s.evidence).toContain("Usually booked 14 days ahead, against 4 for a typical slot.");
    expect(s.prefill.adjustPercent).toBe(10);
  });
  it("only mentions lead time when it really is longer than usual", () => {
    const [s] = suggestRules([stat({ taken: 11, leadDays: 4 }), stat({ time: "12:00", leadDays: 4 })], { ...none, bookings: 30 }).items;
    expect(s.evidence).not.toContain("days ahead");
  });
  it("skips slots with too few weeks and slots a rule already covers", () => {
    expect(suggestRules([stat({ open: 7, taken: 0 })], { ...none, bookings: 30 }).items).toEqual([]);
    expect(suggestRules([stat({ taken: 0 })], { ...none, bookings: 30, covered: () => true }).items).toEqual([]);
  });
});

describe("ruleProblem", () => {
  const base: RuleInput = { name: "Peak", adjustPercent: 15, weekdays: [6], startTime: null, endTime: null, dateFrom: null, dateTo: null, minHoursAhead: null, maxHoursAhead: null };
  it("accepts the limits", () => {
    expect(ruleProblem({ ...base, adjustPercent: 50 })).toBeNull();
    expect(ruleProblem({ ...base, adjustPercent: -50 })).toBeNull();
  });
  it("rejects a change outside -50 to +50, or of 0", () => {
    for (const adjustPercent of [51, -51, 0, 1.5]) expect(ruleProblem({ ...base, adjustPercent })).toMatch(/between -50 and \+50/);
  });
  it("rejects windows that can never match", () => {
    expect(ruleProblem({ ...base, startTime: "18:00", endTime: "14:00" })).toBeTruthy();
    expect(ruleProblem({ ...base, startTime: "25:00" })).toBeTruthy();
    expect(ruleProblem({ ...base, dateFrom: "2026-02-01", dateTo: "2026-01-01" })).toBeTruthy();
    expect(ruleProblem({ ...base, minHoursAhead: 48, maxHoursAhead: 24 })).toBeTruthy();
  });
  it("won't raise every price with no conditions, but allows a blanket sale", () => {
    expect(ruleProblem({ ...base, weekdays: null })).toMatch(/every price/);
    expect(ruleProblem({ ...base, weekdays: null, adjustPercent: -10 })).toBeNull();
  });
});

describe("weekGrid", () => {
  it("prices each slot with the rule a guest would get right now", () => {
    const rule = { id: "r", name: "Noon", experienceIds: null, weekdays: [2], startTime: "12:00", endTime: "14:00", dateFrom: null, dateTo: null, minHoursAhead: null, maxHoursAhead: null, adjustPercent: 15, priority: 0, active: true } as PricingRule;
    const g = weekGrid(exp, [rule], "2026-06-01", 120, new Date("2026-05-20T12:00:00Z"));
    expect(g.times).toEqual(["10:00", "12:00"]);
    expect(g.cells["2026-06-02|10:00"]).toEqual({ cents: 15000, adjustPercent: 0 });
    expect(g.cells["2026-06-02|12:00"]).toEqual({ cents: 17300, adjustPercent: 15 });
    expect(g.cells["2026-06-03|10:00"]).toBeUndefined();
    expect(g.dates[6]).toBe(addDaysKey("2026-06-01", 6));
  });
});

describe("weeklyReportDue (daily cron at 13:00 UTC)", () => {
  const due = (iso: string, last: string | null, week: string, today: string) => weeklyReportDue(new Date(iso), last, week, today);
  it("fires on a Monday's only cron run in winter and summer", () => {
    expect(due("2026-11-09T13:00:00Z", "2026-11-02", "2026-11-09", "2026-11-09")).toBe(true); // 8am EST
    expect(due("2026-06-08T13:00:00Z", "2026-06-01", "2026-06-08", "2026-06-08")).toBe(true); // 9am EDT
  });
  it("sends once per week", () => {
    expect(due("2026-11-09T14:00:00Z", "2026-11-09", "2026-11-09", "2026-11-09")).toBe(false);
    expect(due("2026-11-10T13:00:00Z", "2026-11-09", "2026-11-09", "2026-11-10")).toBe(false);
  });
  it("waits for 7am on Monday, and catches up if Monday's run was missed", () => {
    expect(due("2026-11-09T06:00:00Z", "2026-11-02", "2026-11-09", "2026-11-09")).toBe(false); // 1am New York
    expect(due("2026-11-10T13:00:00Z", "2026-11-02", "2026-11-09", "2026-11-10")).toBe(true);
  });
});
