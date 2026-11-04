import { describe, expect, it } from "vitest";
import { computeQuote, PricingError, refundForCancellation } from "@/lib/booking/pricing";

const perPerson = {
  id: "exp1",
  pricingMode: "per_person" as const,
  durationOptions: [
    { minutes: 120, priceCents: 15000 },
    { minutes: 180, priceCents: 21000 },
  ],
  includedGuests: 1,
  extraGuestCents: 0,
  minGuests: 1,
  maxGuests: 6,
};
const perSession = { ...perPerson, pricingMode: "per_session" as const, includedGuests: 2, extraGuestCents: 5000, durationOptions: [{ minutes: 120, priceCents: 30000 }] };
const promo = (over: object = {}) => ({
  id: "p", code: "TEN", kind: "percent" as const, value: 10, experienceIds: null, minSubtotalCents: 0,
  maxRedemptions: null, redemptions: 0, validFrom: null, validUntil: null, active: true, ...over,
});

describe("computeQuote", () => {
  it("per-person pricing multiplies by guests", () => {
    const q = computeQuote({ experience: perPerson, durationMinutes: 120, guests: 3 });
    expect(q.totalCents).toBe(45000);
  });
  it("uses the price for the chosen duration", () => {
    expect(computeQuote({ experience: perPerson, durationMinutes: 180, guests: 2 }).totalCents).toBe(42000);
  });
  it("per-session pricing charges extra guests above included", () => {
    const q = computeQuote({ experience: perSession, durationMinutes: 120, guests: 4 });
    expect(q.subtotalCents).toBe(30000 + 2 * 5000);
  });
  it("rejects guests outside min/max and unknown durations", () => {
    expect(() => computeQuote({ experience: perPerson, durationMinutes: 120, guests: 7 })).toThrow(PricingError);
    expect(() => computeQuote({ experience: { ...perPerson, minGuests: 10, maxGuests: 30 }, durationMinutes: 120, guests: 4 })).toThrow(PricingError);
    expect(() => computeQuote({ experience: perPerson, durationMinutes: 90, guests: 1 })).toThrow(PricingError);
  });
  it("applies add-ons per booking and per guest", () => {
    const q = computeQuote({
      experience: perPerson, durationMinutes: 120, guests: 2,
      addons: [
        { addon: { id: "a", name: "Video", priceCents: 7500, pricing: "per_booking" } },
        { addon: { id: "b", name: "Drinks", priceCents: 1000, pricing: "per_guest" } },
      ],
    });
    expect(q.addonsCents).toBe(7500 + 2000);
    expect(q.totalCents).toBe(30000 + 9500);
  });
  it("applies percent and fixed promos, capped at the total", () => {
    expect(computeQuote({ experience: perPerson, durationMinutes: 120, guests: 2, promo: promo() }).discountCents).toBe(3000);
    expect(computeQuote({ experience: perPerson, durationMinutes: 120, guests: 1, promo: promo({ kind: "fixed", value: 99999 }) }).totalCents).toBe(0);
  });
  it("reports invalid promos without discounting", () => {
    const now = new Date("2026-06-01");
    const q = computeQuote({ experience: perPerson, durationMinutes: 120, guests: 1, promo: promo({ validUntil: new Date("2026-01-01") }), now });
    expect(q.promoError).toMatch(/expired/);
    expect(q.discountCents).toBe(0);
    expect(computeQuote({ experience: perPerson, durationMinutes: 120, guests: 1, promo: promo({ maxRedemptions: 5, redemptions: 5 }) }).promoError).toBeTruthy();
    expect(computeQuote({ experience: perPerson, durationMinutes: 120, guests: 1, promo: promo({ experienceIds: ["other"] }) }).promoError).toBeTruthy();
  });
  it("gift card covers up to the remaining total", () => {
    const q = computeQuote({ experience: perPerson, durationMinutes: 120, guests: 2, giftCardBalanceCents: 10000 });
    expect(q.giftCardCents).toBe(10000);
    expect(q.totalCents).toBe(20000);
    const q2 = computeQuote({ experience: perPerson, durationMinutes: 120, guests: 1, giftCardBalanceCents: 99999 });
    expect(q2.giftCardCents).toBe(15000);
    expect(q2.totalCents).toBe(0);
  });
});

describe("refundForCancellation", () => {
  const start = new Date("2026-11-20T17:00:00Z");
  it("full refund before the deadline", () => {
    const r = refundForCancellation({ startAt: start, now: new Date("2026-11-19T16:00:00Z"), cancellationHours: 24, amountPaidCents: 30000, amountRefundedCents: 0, giftCardCents: 5000 });
    expect(r).toMatchObject({ eligible: true, cardCents: 30000, giftCardCents: 5000 });
  });
  it("nothing after the deadline", () => {
    const r = refundForCancellation({ startAt: start, now: new Date("2026-11-19T18:00:00Z"), cancellationHours: 24, amountPaidCents: 30000, amountRefundedCents: 0, giftCardCents: 0 });
    expect(r.eligible).toBe(false);
    expect(r.cardCents).toBe(0);
  });
  it("does not double-refund", () => {
    const r = refundForCancellation({ startAt: start, now: new Date("2026-11-01T00:00:00Z"), cancellationHours: 24, amountPaidCents: 30000, amountRefundedCents: 10000, giftCardCents: 0 });
    expect(r.cardCents).toBe(20000);
  });
});
