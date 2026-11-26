import { describe, expect, it } from "vitest";
import { computeQuote, isHigherPriceSlot, PricingError, refundForCancellation } from "@/lib/booking/pricing";

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
  it("adds extra hours as one flat fee, whatever the party size", () => {
    const e = {
      ...perPerson,
      durationOptions: [
        { minutes: 120, priceCents: 15000 },
        { minutes: 180, priceCents: 15000, flatCents: 15000 },
        { minutes: 240, priceCents: 15000, flatCents: 30000 },
      ],
    };
    expect(computeQuote({ experience: e, durationMinutes: 120, guests: 3 }).totalCents).toBe(45000);
    const q = computeQuote({ experience: e, durationMinutes: 240, guests: 3 });
    expect(q.totalCents).toBe(45000 + 30000);
    expect(q.extraTimeCents).toBe(30000);
    expect(q.lines.map((l) => [l.label, l.amountCents])).toEqual([["3 × guest", 45000], ["Extra studio time", 30000]]);
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
  it("waives sub-$0.50 remainders down to $0 so Stripe never rejects checkout", () => {
    const q = computeQuote({ experience: perPerson, durationMinutes: 120, guests: 1, giftCardBalanceCents: 14975 });
    expect(q.giftCardCents).toBe(14975);
    expect(q.totalCents).toBe(0);
    expect(q.lines.some((l) => l.label === "Rounding adjustment" && l.amountCents === -25)).toBe(true);
    // $0.50 exact stays payable (Stripe minimum is $0.50)
    const q50 = computeQuote({ experience: perPerson, durationMinutes: 120, guests: 1, giftCardBalanceCents: 14950 });
    expect(q50.totalCents).toBe(50);
  });
  it("private session applies Option A automatic buyout floor and adds extra hours on top", () => {
    const prod = {
      ...perPerson,
      maxGuests: 15,
      durationOptions: [
        { minutes: 120, priceCents: 15000 },
        { minutes: 180, priceCents: 15000, flatCents: 15000 },
      ],
    };
    // 2 guests regular = $300 < $650 buyout → $650
    const qSmall = computeQuote({ experience: prod, durationMinutes: 120, guests: 2, isPrivate: true, privateRateCents: 65000 });
    expect(qSmall.isPrivate).toBe(true);
    expect(qSmall.privateBuyoutApplied).toBe(true);
    expect(qSmall.subtotalCents).toBe(65000);
    expect(qSmall.totalCents).toBe(65000);

    // 5 guests regular = $750 > $650 buyout → $750 (per-person total wins)
    const qLarge = computeQuote({ experience: prod, durationMinutes: 120, guests: 5, isPrivate: true, privateRateCents: 65000 });
    expect(qLarge.isPrivate).toBe(true);
    expect(qLarge.privateBuyoutApplied).toBe(false);
    expect(qLarge.subtotalCents).toBe(75000);
    expect(qLarge.totalCents).toBe(75000);

    // 2 guests private + 1 extra hour ($150 flat) = $650 + $150 = $800
    const qExtra = computeQuote({ experience: prod, durationMinutes: 180, guests: 2, isPrivate: true, privateRateCents: 65000 });
    expect(qExtra.privateBuyoutApplied).toBe(true);
    expect(qExtra.extraTimeCents).toBe(15000);
    expect(qExtra.subtotalCents).toBe(80000);
    expect(qExtra.totalCents).toBe(80000);

    // DJ $450 buyout for 1 guest, 4 guests regular = $540 > $450
    const dj = { ...perPerson, maxGuests: 5, durationOptions: [{ minutes: 120, priceCents: 13500 }] };
    expect(computeQuote({ experience: dj, durationMinutes: 120, guests: 1, isPrivate: true, privateRateCents: 45000 }).totalCents).toBe(45000);
    expect(computeQuote({ experience: dj, durationMinutes: 120, guests: 4, isPrivate: true, privateRateCents: 45000 }).totalCents).toBe(54000);

    // Smart pricing applies on top of buyout
    const qSmart = computeQuote({ experience: prod, durationMinutes: 120, guests: 2, isPrivate: true, privateRateCents: 65000, priceRule: { name: "Weekday", adjustPercent: -10 } });
    expect(qSmart.priceAdjustCents).toBe(-6500);
    expect(qSmart.subtotalCents).toBe(58500);
  });
  it("private session allows 1 guest even when shared minGuests is higher, and rejects quote-only experiences", () => {
    const meditation = { ...perPerson, minGuests: 6, maxGuests: 15, durationOptions: [{ minutes: 120, priceCents: 8500 }] };
    // Shared rejects 2 guests
    expect(() => computeQuote({ experience: meditation, durationMinutes: 120, guests: 2 })).toThrow(PricingError);
    // Private allows 1–5 guests at $1,200 buyout; 15 guests regular = $1,275 > $1,200
    const qPrivate = computeQuote({ experience: meditation, durationMinutes: 120, guests: 2, isPrivate: true, privateRateCents: 120000 });
    expect(qPrivate.totalCents).toBe(120000);
    expect(qPrivate.privateBuyoutApplied).toBe(true);
    const qFull = computeQuote({ experience: meditation, durationMinutes: 120, guests: 15, isPrivate: true, privateRateCents: 120000 });
    expect(qFull.totalCents).toBe(127500);
    expect(qFull.privateBuyoutApplied).toBe(false);
    // Rejects private when no privateRateCents configured
    expect(() => computeQuote({ experience: meditation, durationMinutes: 120, guests: 2, isPrivate: true, privateRateCents: null })).toThrow(PricingError);
    expect(() => computeQuote({ experience: meditation, durationMinutes: 120, guests: 2, isPrivate: true, privateRateCents: 0 })).toThrow(PricingError);
  });
});

describe("isHigherPriceSlot", () => {
  it("blocks moving from a discounted slot to a normal or peak slot", () => {
    // Base $150, booked at -20% ($120, priceAdjustCents = -3000)
    expect(isHigherPriceSlot({ subtotalCents: 12000, priceAdjustCents: -3000 }, 0)).toBe(true);
    expect(isHigherPriceSlot({ subtotalCents: 12000, priceAdjustCents: -3000 }, 20)).toBe(true);
    // Moving to same or cheaper discount is allowed
    expect(isHigherPriceSlot({ subtotalCents: 12000, priceAdjustCents: -3000 }, -20)).toBe(false);
    expect(isHigherPriceSlot({ subtotalCents: 12000, priceAdjustCents: -3000 }, -30)).toBe(false);
  });
  it("blocks moving from a base-price slot to a peak slot", () => {
    expect(isHigherPriceSlot({ subtotalCents: 15000, priceAdjustCents: 0 }, 15)).toBe(true);
    expect(isHigherPriceSlot({ subtotalCents: 15000, priceAdjustCents: 0 }, 0)).toBe(false);
    expect(isHigherPriceSlot({ subtotalCents: 15000, priceAdjustCents: 0 }, -10)).toBe(false);
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
