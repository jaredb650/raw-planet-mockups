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

/** "$150 per guest" / "$300 per session" for the shortest option. */
export function fromPriceLabel(e: PublicExperience): string {
  const opts = sortedDurations(e);
  const min = Math.min(...opts.map((o) => o.priceCents));
  const unit = e.pricingMode === "per_session" ? "per session" : "per guest";
  return `${opts.length > 1 ? "From " : ""}${formatMoney(min)} ${unit}`;
}

/** Chip label for a duration option: "2 hours · $150". */
export function durationChip(e: PublicExperience, minutes: number): { title: string; price: string } {
  const opt = e.durationOptions.find((o) => o.minutes === minutes);
  return { title: opt?.label || fmtDuration(minutes), price: opt ? formatMoney(opt.priceCents) : "" };
}

/** Sensible starting guest count: 2 for private sessions, the minimum for groups. */
export function defaultGuests(e: Pick<PublicExperience, "minGuests" | "maxGuests">): number {
  return Math.min(e.maxGuests, Math.max(e.minGuests, 2));
}

export function clampGuests(e: Pick<PublicExperience, "minGuests" | "maxGuests">, n: number): number {
  return Math.min(e.maxGuests, Math.max(e.minGuests, Math.round(n) || e.minGuests));
}

export function groupHint(e: Pick<PublicExperience, "minGuests" | "maxGuests">): string {
  if (e.minGuests >= 5) return `Groups of ${e.minGuests} to ${e.maxGuests}`;
  return `Up to ${e.maxGuests} guests`;
}

/** Client-side, display-only quote (the server re-quotes at checkout). */
export function displayQuote(e: PublicExperience, minutes: number, guests: number): Quote | null {
  try {
    return computeQuote({ experience: e, durationMinutes: minutes, guests });
  } catch (err) {
    if (err instanceof PricingError) return null;
    throw err;
  }
}

export function guestsLabel(n: number): string {
  return `${n} ${n === 1 ? "guest" : "guests"}`;
}
