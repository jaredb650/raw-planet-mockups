/**
 * Display helpers for the booking flow (safe on server and client).
 */
import type { PublicExperience } from "@/lib/queries/public";
import { computeQuote, PricingError, type Quote } from "@/lib/booking/pricing";
import { formatMoney } from "@/lib/money";
import { fmtDuration } from "@/lib/time";

export type Theme = "production" | "dj" | "wellness";

export function themeOf(e: Pick<PublicExperience, "theme">): Theme {
  return e.theme === "dj" || e.theme === "wellness" ? e.theme : "production";
}

/** 24 → "24 hours", 72 → "3 days", 48 → "48 hours". */
export function noticeLabel(hours: number): string {
  if (hours >= 72 && hours % 24 === 0) return `${hours / 24} days`;
  if (hours === 1) return "1 hour";
  return `${hours} hours`;
}

export function cancellationLine(e: Pick<PublicExperience, "cancellationHours">): string {
  return `Free cancellation up to ${noticeLabel(e.cancellationHours)} before your session.`;
}

export function sortedDurations(e: Pick<PublicExperience, "durationOptions">) {
  return [...e.durationOptions].sort((a, b) => a.minutes - b.minutes);
}

/** "$150 per person" / "$300 per session" for the shortest option. */
export function fromPriceLabel(e: PublicExperience): string {
  const prices = e.durationOptions.map((o) => o.priceCents);
  const unit = e.pricingMode === "per_session" ? "per session" : "per person";
  return `${new Set(prices).size > 1 || e.priceVaries ? "From " : ""}${formatMoney(Math.min(...prices))} ${unit}`;
}

/** Minimum buyout rate in cents for a private session, or null if quoted on request. */
export function privateRateOf(e: Pick<PublicExperience, "meta">): number | null {
  const rate = e.meta?.privateRateCents;
  return rate && rate > 0 ? rate : null;
}

export function minGuestsFor(e: Pick<PublicExperience, "minGuests">, isPrivate = false): number {
  return isPrivate ? 1 : e.minGuests;
}

/** Chip label for a duration option: "2 hours · $150", or "3 hours · +$150" when the extra time is a flat fee. */
export function durationChip(e: PublicExperience, minutes: number, isPrivate = false): { title: string; price: string } {
  const opt = e.durationOptions.find((o) => o.minutes === minutes);
  const privateRate = isPrivate ? privateRateOf(e) : null;
  const price = !opt
    ? ""
    : opt.flatCents
      ? `+${formatMoney(opt.flatCents)}`
      : privateRate
        ? `From ${formatMoney(privateRate)}`
        : formatMoney(opt.priceCents);
  return { title: opt?.label || fmtDuration(minutes), price };
}

/** Sensible starting guest count: 2, or the minimum for groups. */
export function defaultGuests(e: Pick<PublicExperience, "minGuests" | "maxGuests">, isPrivate = false): number {
  return Math.min(e.maxGuests, Math.max(minGuestsFor(e, isPrivate), 2));
}

export function clampGuests(e: Pick<PublicExperience, "minGuests" | "maxGuests">, n: number, isPrivate = false): number {
  const min = minGuestsFor(e, isPrivate);
  return Math.min(e.maxGuests, Math.max(min, Math.round(n) || min));
}

export function groupHint(e: Pick<PublicExperience, "minGuests" | "maxGuests">, isPrivate = false): string {
  if (isPrivate) return `Up to ${e.maxGuests} guests · studio reserved exclusively`;
  if (e.minGuests >= 5) return `Groups of ${e.minGuests} to ${e.maxGuests}`;
  return `Up to ${e.maxGuests} guests`;
}

/** Client-side, display-only quote (the server re-quotes at checkout). */
export function displayQuote(
  e: PublicExperience,
  minutes: number,
  guests: number,
  adjustPercent = 0,
  isPrivate = false,
): Quote | null {
  try {
    return computeQuote({
      experience: e,
      durationMinutes: minutes,
      guests,
      isPrivate,
      privateRateCents: privateRateOf(e),
      priceRule: { name: "", adjustPercent },
    });
  } catch (err) {
    if (err instanceof PricingError) return null;
    throw err;
  }
}

export function guestsLabel(n: number): string {
  return `${n} ${n === 1 ? "guest" : "guests"}`;
}

/** Slot price wording in the visitor's language. Only rendered after the client has loaded slots. */
export function slotPriceCopy(guests: number): { offPeak: string; note: string } {
  const es = typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("es");
  return es
    ? { offPeak: "Horario económico", note: `Precio total para ${guests} ${guests === 1 ? "persona" : "personas"}. Varía según el día y la hora.` }
    : { offPeak: "Off-peak", note: `Total for ${guestsLabel(guests)}. Prices vary by day and time.` };
}
