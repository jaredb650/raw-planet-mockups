import { describe, expect, it } from "vitest";
import { adjustedCents, computeQuote, pickPriceRule, ruleApplies, type PriceRuleInput } from "@/lib/booking/pricing";
import { fromLocal } from "@/lib/time";

const rule = (over: Partial<PriceRuleInput> = {}): PriceRuleInput => ({
  id: "r", name: "Rule", experienceIds: null, weekdays: null, startTime: null, endTime: null, dateFrom: null, dateTo: null,
  minHoursAhead: null, maxHoursAhead: null, adjustPercent: 10, priority: 0, active: true, ...over,
});
const NOW = new Date("2026-06-01T12:00:00Z");
const SAT_2PM = fromLocal("2026-06-06", "14:00");
const applies = (over: Partial<PriceRuleInput>, at = SAT_2PM, now = NOW) => ruleApplies(rule(over), "exp1", at, now);

describe("rule matching", () => {
  it("needs every condition to match", () => {
    expect(applies({})).toBe(true);
    expect(applies({ active: false })).toBe(false);
    expect(applies({ experienceIds: ["exp1"] })).toBe(true);
    expect(applies({ experienceIds: ["exp2"] })).toBe(false);
    expect(applies({ weekdays: [6] })).toBe(true);
    expect(applies({ weekdays: [0, 1] })).toBe(false);
  });
  it("treats start time as inclusive, end time as exclusive", () => {
    expect(applies({ startTime: "14:00", endTime: "16:00" })).toBe(true);
    expect(applies({ startTime: "12:00", endTime: "14:00" })).toBe(false);
    expect(applies({ startTime: "14:01" })).toBe(false);
  });
  it("treats date ranges as inclusive", () => {
    expect(applies({ dateFrom: "2026-06-06", dateTo: "2026-06-06" })).toBe(true);
    expect(applies({ dateTo: "2026-06-05" })).toBe(false);
    expect(applies({ dateFrom: "2026-06-07" })).toBe(false);
  });
  it("measures hours ahead from now", () => {
    const now = new Date(SAT_2PM.getTime() - 48 * 3600_000);
    expect(applies({ minHoursAhead: 48 }, SAT_2PM, now)).toBe(true);
    expect(applies({ minHoursAhead: 49 }, SAT_2PM, now)).toBe(false);
    expect(applies({ maxHoursAhead: 48 }, SAT_2PM, now)).toBe(true);
    expect(applies({ maxHoursAhead: 47 }, SAT_2PM, now)).toBe(false);
  });
  it("uses New York time, not UTC, late on a Friday night", () => {
    const fri11pm = fromLocal("2026-06-05", "23:00"); // already Saturday 03:00 in UTC
    expect(fri11pm.getUTCDay()).toBe(6);
    expect(applies({ weekdays: [5], startTime: "22:00" }, fri11pm)).toBe(true);
    expect(applies({ weekdays: [6] }, fri11pm)).toBe(false);
    expect(applies({ dateFrom: "2026-06-05", dateTo: "2026-06-05" }, fri11pm)).toBe(true);
  });
  it("keeps the wall clock across DST changes", () => {
    const window = { startTime: "14:00", endTime: "15:00" };
    expect(applies(window, fromLocal("2026-10-31", "14:00"))).toBe(true); // EDT, 18:00 UTC
    expect(applies(window, fromLocal("2026-11-01", "14:00"))).toBe(true); // first EST day, 19:00 UTC
    expect(applies(window, new Date("2026-11-01T18:00:00Z"))).toBe(false); // 1pm in New York that day
    expect(applies(window, fromLocal("2026-03-08", "14:00"))).toBe(true); // first EDT day
    expect(applies({ weekdays: [0] }, fromLocal("2026-11-01", "00:30"))).toBe(true);
  });
  it("counts real elapsed hours on a 25-hour day", () => {
    const now = fromLocal("2026-10-31", "14:00");
    const next2pm = fromLocal("2026-11-01", "14:00"); // 25 hours later, clocks went back
    expect(applies({ minHoursAhead: 25 }, next2pm, now)).toBe(true);
    expect(applies({ maxHoursAhead: 24 }, next2pm, now)).toBe(false);
  });
});

describe("pickPriceRule", () => {
  const pick = (rules: PriceRuleInput[]) => pickPriceRule(rules, "exp1", SAT_2PM, NOW);
  it("takes the single highest priority match, never stacking", () => {
    const rules = [rule({ id: "a", adjustPercent: 10, priority: 1 }), rule({ id: "b", adjustPercent: 20, priority: 5 }), rule({ id: "c", adjustPercent: -30, priority: 3 })];
    expect(pick(rules)?.id).toBe("b");
  });
  it("skips a higher priority rule that doesn't match", () => {
    expect(pick([rule({ id: "a", priority: 1 }), rule({ id: "b", priority: 9, weekdays: [1] })])?.id).toBe("a");
  });
  it("breaks ties the same way whatever the order, in the guest's favour", () => {
    const a = rule({ id: "a", adjustPercent: 15 });
    const b = rule({ id: "b", adjustPercent: -10 });
    expect(pick([a, b])?.id).toBe("b");
    expect(pick([b, a])?.id).toBe("b");
  });
  it("returns null with no match", () => {
    expect(pick([rule({ active: false })])).toBeNull();
  });
});

describe("rounding", () => {
  it("rounds the adjusted price to whole dollars", () => {
    expect(adjustedCents(15000, 15)).toBe(17300); // $172.50 rounds up
    expect(adjustedCents(15000, -15)).toBe(12800); // $127.50 rounds up
    expect(adjustedCents(33300, 7)).toBe(35600); // $356.31
  });
  it("leaves an unadjusted price alone, cents and all", () => {
    expect(adjustedCents(14950, 0)).toBe(14950);
  });
});

const perPerson = {
  id: "exp1", pricingMode: "per_person" as const, durationOptions: [{ minutes: 120, priceCents: 15000 }],
  includedGuests: 1, extraGuestCents: 0, minGuests: 1, maxGuests: 6,
};
const perSession = { ...perPerson, pricingMode: "per_session" as const, includedGuests: 2, extraGuestCents: 5000, durationOptions: [{ minutes: 120, priceCents: 30000 }] };
const promo = (over: object = {}) => ({
  id: "p", code: "TEN", kind: "percent" as const, value: 10, experienceIds: null, minSubtotalCents: 0,
  maxRedemptions: null, redemptions: 0, validFrom: null, validUntil: null, active: true, ...over,
});
const addon = { addon: { id: "a", name: "Video", priceCents: 7550, pricing: "per_booking" as const } };

describe("computeQuote with a rule", () => {
  it("rounds once on the whole session subtotal, not per guest", () => {
    const q = computeQuote({ experience: perPerson, durationMinutes: 120, guests: 3, priceRule: { name: "Peak", adjustPercent: 15 } });
    expect(q.subtotalCents).toBe(51800); // $517.50, not 3 × $173
    expect(q.priceAdjustCents).toBe(6800);
    expect(q.priceRuleName).toBe("Peak");
  });
  it("adjusts extra guests too, and session lines always add up to the subtotal", () => {
    const q = computeQuote({ experience: perSession, durationMinutes: 120, guests: 4, priceRule: { name: "Peak", adjustPercent: 15 } });
    expect(q.subtotalCents).toBe(46000);
    expect(q.baseCents + q.extraGuestsCents).toBe(46000);
    expect(q.lines.filter((l) => l.kind === "base" || l.kind === "guests").reduce((n, l) => n + l.amountCents, 0)).toBe(46000);
  });
  it("never shows a negative line on a deep discount with many extra guests", () => {
    const big = { ...perSession, maxGuests: 12, durationOptions: [{ minutes: 120, priceCents: 10000 }] };
    const q = computeQuote({ experience: big, durationMinutes: 120, guests: 12, priceRule: { name: "Quiet", adjustPercent: -50 } });
    expect(q.lines.every((l) => l.amountCents > 0)).toBe(true);
    expect(q.baseCents + q.extraGuestsCents).toBe(q.subtotalCents);
  });
  it("has no surcharge line", () => {
    const q = computeQuote({ experience: perPerson, durationMinutes: 120, guests: 2, priceRule: { name: "Peak", adjustPercent: 20 } });
    expect(q.lines).toEqual([{ label: "2 × guest", amountCents: 36000, kind: "base" }]);
  });
  it("leaves add-ons out of the rule", () => {
    const q = computeQuote({ experience: perPerson, durationMinutes: 120, guests: 1, addons: [addon], priceRule: { name: "Peak", adjustPercent: 10 } });
    expect(q.subtotalCents).toBe(16500);
    expect(q.addonsCents).toBe(7550);
    expect(q.priceAdjustCents).toBe(1500);
  });
  it("applies in order: rule, add-ons, promo, gift card", () => {
    const q = computeQuote({
      experience: perPerson, durationMinutes: 120, guests: 2, addons: [addon], promo: promo(), giftCardBalanceCents: 10000,
      priceRule: { name: "Off-peak", adjustPercent: -20 },
    });
    expect(q.subtotalCents).toBe(24000);
    expect(q.addonsCents).toBe(7550);
    expect(q.discountCents).toBe(3155); // 10% of $315.50, rounded to the cent
    expect(q.giftCardCents).toBe(10000);
    expect(q.totalCents).toBe(24000 + 7550 - 3155 - 10000);
    expect(q.priceAdjustCents).toBe(-6000);
  });
  it("checks a promo minimum against the real session price", () => {
    const min = promo({ minSubtotalCents: 15000 });
    const q = computeQuote({ experience: perPerson, durationMinutes: 120, guests: 1, promo: min, priceRule: { name: "Off-peak", adjustPercent: -20 } });
    expect(q.promoError).toBeTruthy();
    expect(q.discountCents).toBe(0);
  });
  it("lets a gift card cover a surge exactly", () => {
    const q = computeQuote({ experience: perPerson, durationMinutes: 120, guests: 1, giftCardBalanceCents: 50000, priceRule: { name: "Peak", adjustPercent: 15 } });
    expect(q.giftCardCents).toBe(17300);
    expect(q.totalCents).toBe(0);
  });
  it("records nothing without a rule", () => {
    const q = computeQuote({ experience: perPerson, durationMinutes: 120, guests: 1 });
    expect(q.priceAdjustCents).toBe(0);
    expect(q.priceRuleName).toBeNull();
  });
});
