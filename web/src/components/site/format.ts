/**
 * Pure display helpers for experience records (safe on server and client).
 */
import type { PublicExperience } from "@/lib/queries/public";
import { formatMoney } from "@/lib/money";
import { fmtDuration } from "@/lib/time";

export type Theme = "production" | "dj" | "wellness";

export function themeOf(e: Pick<PublicExperience, "theme">): Theme {
  return e.theme === "dj" || e.theme === "wellness" ? e.theme : "production";
}

export function fromPriceCents(e: Pick<PublicExperience, "durationOptions">): number {
  return Math.min(...e.durationOptions.map((o) => o.priceCents));
}

export function shortestMinutes(e: Pick<PublicExperience, "durationOptions">): number {
  return Math.min(...e.durationOptions.map((o) => o.minutes));
}

/** "From $150 per guest" / "From $300 per session" */
export function priceLabel(e: PublicExperience, opts: { from?: boolean } = {}): string {
  const many = e.durationOptions.length > 1;
  const from = opts.from ?? many;
  const unit = e.pricingMode === "per_session" ? "per session" : "per guest";
  return `${from ? "From " : ""}${formatMoney(fromPriceCents(e))} ${unit}`;
}

export function priceUnit(e: PublicExperience): string {
  return e.pricingMode === "per_session"
    ? e.includedGuests > 1
      ? `per session, up to ${e.includedGuests} guests`
      : "per session"
    : "per guest";
}

/** "2 hours" or "2, 3 or 4 hours" */
export function durationLabel(e: PublicExperience): string {
  const mins = [...e.durationOptions.map((o) => o.minutes)].sort((a, b) => a - b);
  if (mins.length === 1) return fmtDuration(mins[0]);
  if (mins.every((m) => m % 60 === 0)) {
    const hrs = mins.map((m) => m / 60);
    return `${hrs.slice(0, -1).join(", ")} or ${hrs[hrs.length - 1]} hours`;
  }
  return mins.map(fmtDuration).join(" / ");
}

export function groupLabel(e: PublicExperience): string {
  if (e.minGuests >= 5) return `Groups of ${e.minGuests}+`;
  if (e.maxGuests <= 1) return "Just you";
  return `Private, 1–${e.maxGuests} guests`;
}

export function ageLabel(e: PublicExperience): string | null {
  return e.minAge ? `Ages ${e.minAge}+` : null;
}

/** Quick facts used on rows and cards. `ph` marks facts still to confirm. */
export function quickFacts(e: PublicExperience): { label: string; ph?: boolean }[] {
  const facts: { label: string; ph?: boolean }[] = [
    { label: durationLabel(e), ph: e.isPlaceholder },
    { label: priceLabel(e), ph: e.isPlaceholder },
    { label: groupLabel(e) },
  ];
  const age = ageLabel(e);
  if (age) facts.push({ label: age });
  facts.push({ label: e.locationArea });
  return facts;
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Shortens a long review to a pull quote: first sentence … last sentence,
 * the way the Open Door mockup trims the lead quote. Short reviews pass through.
 */
export function pullQuote(body: string, max = 180): { text: string; trimmed: boolean } {
  const clean = body.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return { text: clean, trimmed: false };
  const parts = clean.split(/(?<=[.!?])\s+/).map((s) => s.replace(/^[.…\s]+/, "").trim()).filter(Boolean);
  const first = parts[0] ?? clean;
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  if (last && first.length + last.length + 3 <= max + 40) return { text: `${first} … ${last}`, trimmed: true };
  if (first.length <= max + 40) return { text: `${first} …`, trimmed: true };
  return { text: `${clean.slice(0, max).replace(/\s+\S*$/, "")} …`, trimmed: true };
}
