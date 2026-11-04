/**
 * Pure pricing engine — no DB access, fully unit-tested.
 * The server always recomputes the quote; client-side quotes are display-only.
 */
import type { Addon, Experience, PromoCode } from "@/lib/db/schema";

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
  now?: Date;
};

export type QuoteLine = { label: string; amountCents: number; kind: "base" | "guests" | "addon" | "discount" | "giftcard" };

export type Quote = {
  baseCents: number;
  extraGuestsCents: number;
  subtotalCents: number; // base + extra guests
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
  let baseCents: number;
  let extraGuestsCents = 0;

  if (e.pricingMode === "per_person") {
    baseCents = unit * guests;
    lines.push({ label: `${guests} × guest`, amountCents: baseCents, kind: "base" });
  } else {
    baseCents = unit;
    lines.push({ label: "Private session", amountCents: baseCents, kind: "base" });
    const extra = Math.max(0, guests - e.includedGuests);
    if (extra > 0 && e.extraGuestCents > 0) {
      extraGuestsCents = extra * e.extraGuestCents;
      lines.push({ label: `${extra} extra guest${extra > 1 ? "s" : ""}`, amountCents: extraGuestsCents, kind: "guests" });
    }
  }
  const subtotalCents = baseCents + extraGuestsCents;

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
