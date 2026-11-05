/**
 * Pure pricing engine — no DB access, fully unit-tested.
 * The server always recomputes the quote; client-side quotes are display-only.
 */
import type { Addon, Experience, PricingRule, PromoCode } from "@/lib/db/schema";
import { fmt, localDateKey, weekdayOf } from "@/lib/time";

export type QuoteInput = {
  experience: Pick<
    Experience,
    "id" | "pricingMode" | "durationOptions" | "includedGuests" | "extraGuestCents" | "minGuests" | "maxGuests"
  >;
  durationMinutes: number;
  guests: number;
  addons?: { addon: Pick<Addon, "id" | "name" | "priceCents" | "pricing">; quantity?: number }[];
  promo?: Pick<
    PromoCode,
    "id" | "code" | "kind" | "value" | "experienceIds" | "minSubtotalCents" | "maxRedemptions" | "redemptions" | "validFrom" | "validUntil" | "active"
  > | null;
  giftCardBalanceCents?: number;
  /** The smart pricing rule for this slot, from pickPriceRule. */
  priceRule?: Pick<PricingRule, "name" | "adjustPercent"> | null;
  now?: Date;
};

export type QuoteLine = { label: string; amountCents: number; kind: "base" | "guests" | "addon" | "discount" | "giftcard" };

export type Quote = {
  baseCents: number;
  extraGuestsCents: number;
  subtotalCents: number; // base + extra guests, smart pricing included
  priceAdjustCents: number; // smart pricing share of subtotalCents (negative = discount)
  priceRuleName: string | null;
  addonsCents: number;
  addonLines: { addonId: string; name: string; quantity: number; unitCents: number; totalCents: number }[];
  discountCents: number;
  promoError: string | null;
  giftCardCents: number;
  totalCents: number; // amount to charge by card
  lines: QuoteLine[];
};

export class PricingError extends Error {}

export function durationPrice(experience: QuoteInput["experience"], minutes: number): number {
  const opt = experience.durationOptions.find((o) => o.minutes === minutes);
  if (!opt) throw new PricingError(`This experience can't be booked for ${minutes} minutes.`);
  return opt.priceCents;
}

/** Lowest headline price ("from $X") for cards and SEO. */
export function fromPrice(experience: Pick<Experience, "durationOptions" | "pricingMode">): number {
  return Math.min(...experience.durationOptions.map((o) => o.priceCents));
}

/* ------------------------------------------------------------------ */
/* Smart pricing                                                        */
/* ------------------------------------------------------------------ */

export type PriceRuleInput = Pick<
  PricingRule,
  | "id" | "name" | "experienceIds" | "weekdays" | "startTime" | "endTime" | "dateFrom" | "dateTo"
  | "minHoursAhead" | "maxHoursAhead" | "adjustPercent" | "priority" | "active"
>;

/** All conditions read in business time. startTime is inclusive, endTime exclusive, dates inclusive. */
export function ruleApplies(r: PriceRuleInput, experienceId: string, startAt: Date, now: Date): boolean {
  if (!r.active) return false;
  if (r.experienceIds?.length && !r.experienceIds.includes(experienceId)) return false;
  const dateKey = localDateKey(startAt);
  if (r.weekdays?.length && !r.weekdays.includes(weekdayOf(dateKey))) return false;
  if (r.dateFrom && dateKey < r.dateFrom) return false;
  if (r.dateTo && dateKey > r.dateTo) return false;
  const time = fmt(startAt, "HH:mm");
  if (r.startTime && time < r.startTime) return false;
  if (r.endTime && time >= r.endTime) return false;
  const hoursAhead = (startAt.getTime() - now.getTime()) / 3600_000;
  if (r.minHoursAhead != null && hoursAhead < r.minHoursAhead) return false;
  if (r.maxHoursAhead != null && hoursAhead > r.maxHoursAhead) return false;
  return true;
}

/** The single rule for a slot: highest priority wins, rules never stack. Ties go to the lower price, so order never matters. */
export function pickPriceRule<T extends PriceRuleInput>(rules: T[], experienceId: string, startAt: Date, now: Date): T | null {
  const hits = rules.filter((r) => ruleApplies(r, experienceId, startAt, now));
  hits.sort((a, b) => b.priority - a.priority || a.adjustPercent - b.adjustPercent || a.id.localeCompare(b.id));
  return hits[0] ?? null;
}

/** A smart price is always whole dollars. No rule, no rounding. */
export function adjustedCents(cents: number, percent: number): number {
  return percent ? Math.round((cents * (100 + percent)) / 10_000) * 100 : cents;
}

export function validatePromo(
  promo: NonNullable<QuoteInput["promo"]>,
  experienceId: string,
  subtotalCents: number,
  now: Date,
): string | null {
  if (!promo.active) return "This code is no longer active.";
  if (promo.validFrom && now < promo.validFrom) return "This code isn't active yet.";
  if (promo.validUntil && now > promo.validUntil) return "This code has expired.";
  if (promo.maxRedemptions != null && promo.redemptions >= promo.maxRedemptions) return "This code has been fully used.";
  if (promo.experienceIds && promo.experienceIds.length > 0 && !promo.experienceIds.includes(experienceId))
    return "This code doesn't apply to this experience.";
  if (subtotalCents < promo.minSubtotalCents) return "Your booking doesn't meet this code's minimum.";
  return null;
}

export function computeQuote(input: QuoteInput): Quote {
  const { experience: e, durationMinutes, guests } = input;
  const now = input.now ?? new Date();
  if (!Number.isInteger(guests) || guests < e.minGuests || guests > e.maxGuests)
    throw new PricingError(
      e.minGuests === e.maxGuests
        ? `This experience is for exactly ${e.minGuests} guests.`
        : `Choose between ${e.minGuests} and ${e.maxGuests} guests.`,
    );

  const unit = durationPrice(e, durationMinutes);
  const lines: QuoteLine[] = [];
  const extra = e.pricingMode === "per_person" ? 0 : Math.max(0, guests - e.includedGuests);
  let baseCents = e.pricingMode === "per_person" ? unit * guests : unit;
  let extraGuestsCents = e.extraGuestCents > 0 ? extra * e.extraGuestCents : 0;

  // Smart pricing is folded into the session lines: it is the price of this slot, never a fee line.
  const listCents = baseCents + extraGuestsCents;
  const subtotalCents = adjustedCents(listCents, input.priceRule?.adjustPercent ?? 0);
  const priceAdjustCents = subtotalCents - listCents;
  if (priceAdjustCents !== 0) {
    extraGuestsCents = Math.round((extraGuestsCents * subtotalCents) / listCents / 100) * 100;
    baseCents = subtotalCents - extraGuestsCents;
  }
  lines.push(
    e.pricingMode === "per_person"
      ? { label: `${guests} × guest`, amountCents: baseCents, kind: "base" }
      : { label: "Private session", amountCents: baseCents, kind: "base" },
  );
  if (extraGuestsCents > 0) lines.push({ label: `${extra} extra guest${extra > 1 ? "s" : ""}`, amountCents: extraGuestsCents, kind: "guests" });

  const addonLines = (input.addons ?? []).map(({ addon, quantity }) => {
    const qty = addon.pricing === "per_guest" ? guests : Math.max(1, quantity ?? 1);
    const totalCents = addon.priceCents * qty;
    lines.push({ label: qty > 1 ? `${addon.name} × ${qty}` : addon.name, amountCents: totalCents, kind: "addon" });
    return { addonId: addon.id, name: addon.name, quantity: qty, unitCents: addon.priceCents, totalCents };
  });
  const addonsCents = addonLines.reduce((s, l) => s + l.totalCents, 0);

  let discountCents = 0;
  let promoError: string | null = null;
  if (input.promo) {
    promoError = validatePromo(input.promo, e.id, subtotalCents, now);
    if (!promoError) {
      const discountable = subtotalCents + addonsCents;
      discountCents =
        input.promo.kind === "percent"
          ? Math.round((discountable * Math.min(100, Math.max(0, input.promo.value))) / 100)
          : Math.min(discountable, input.promo.value);
      if (discountCents > 0)
        lines.push({ label: `Code ${input.promo.code}`, amountCents: -discountCents, kind: "discount" });
    }
  }

  const afterDiscount = subtotalCents + addonsCents - discountCents;
  const giftCardCents = Math.max(0, Math.min(afterDiscount, input.giftCardBalanceCents ?? 0));
  if (giftCardCents > 0) lines.push({ label: "Gift card", amountCents: -giftCardCents, kind: "giftcard" });

  return {
    baseCents,
    extraGuestsCents,
    subtotalCents,
    priceAdjustCents,
    priceRuleName: priceAdjustCents !== 0 ? (input.priceRule?.name ?? null) : null,
    addonsCents,
    addonLines,
    discountCents,
    promoError,
    giftCardCents,
    totalCents: afterDiscount - giftCardCents,
    lines,
  };
}

/**
 * Refund owed when a guest cancels.
 * Full refund of what they paid if they cancel at least `cancellationHours`
 * before the start; otherwise nothing (host can still refund manually).
 */
export function refundForCancellation(opts: {
  startAt: Date;
  now?: Date;
  cancellationHours: number;
  amountPaidCents: number;
  amountRefundedCents: number;
  giftCardCents: number;
}): { eligible: boolean; cardCents: number; giftCardCents: number; deadline: Date } {
  const now = opts.now ?? new Date();
  const deadline = new Date(opts.startAt.getTime() - opts.cancellationHours * 3600_000);
  const eligible = now <= deadline;
  if (!eligible) return { eligible, cardCents: 0, giftCardCents: 0, deadline };
  return {
    eligible,
    cardCents: Math.max(0, opts.amountPaidCents - opts.amountRefundedCents),
    giftCardCents: opts.giftCardCents,
    deadline,
  };
}
