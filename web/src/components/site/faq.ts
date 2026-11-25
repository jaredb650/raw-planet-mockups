/** Fills {{tokens}} in static FAQ copy from live experience data. */
import { FAQ, PRIVATE_SESSION_CENTS, type FaqEntry } from "@/content/site";
import { formatMoney } from "@/lib/money";
import type { PublicExperience } from "@/lib/queries/public";
import { priceLabel } from "./format";

const listJoin = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

function groupBy<T>(items: T[], key: (t: T) => string | number): Map<string | number, T[]> {
  const m = new Map<string | number, T[]>();
  for (const i of items) m.set(key(i), [...(m.get(key(i)) ?? []), i]);
  return m;
}

const lower = (e: PublicExperience) => e.shortName.charAt(0).toLowerCase() + e.shortName.slice(1);

export function cancellationPhrase(experiences: PublicExperience[]): string {
  if (!experiences.length) return "24 hours before your session";
  const groups = [...groupBy(experiences, (e) => e.cancellationHours).entries()].sort(([a], [b]) => Number(a) - Number(b));
  if (groups.length === 1) return `${groups[0][0]} hours before your session`;
  return listJoin(groups.map(([h, es]) => `${h} hours before for ${listJoin(es.map(lower))}`));
}

/** "$150 per person for the Music Production Experience, $135 per person for …" */
export function pricesPhrase(experiences: PublicExperience[]): string {
  const s = listJoin(
    experiences.map((e) => `${priceLabel(e)} for the ${e.name}${e.minGuests > 1 ? ` (minimum booking of ${e.minGuests} guests)` : ""}`),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "The Music Production Experience holds up to 15 guests, the …" */
export function capacityPhrase(experiences: PublicExperience[]): string {
  const s = listJoin(
    experiences.map((e) => `the ${e.name} holds up to ${e.maxGuests} guests${e.minGuests > 1 ? ` (minimum booking of ${e.minGuests})` : ""}`),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Music Production Experience: East Village, New York. Learn to DJ Experience: …" */
export function locationsPhrase(experiences: PublicExperience[]): string {
  const list = experiences.map((e) => `${e.name}: ${e.locationArea}`).join(". ");
  return list ? `${list}. Exact studio address and arrival details are sent in your confirmation email.` : "";
}

/** "$650 for the Music Production Experience and $450 for the Learn to DJ Experience" */
export function privateRatesPhrase(experiences: PublicExperience[]): string {
  return listJoin(
    experiences
      .map((e) => ({ e, rate: e.meta ? e.meta.privateRateCents : (PRIVATE_SESSION_CENTS[e.theme] ?? null) }))
      .filter((x): x is { e: PublicExperience; rate: number } => Boolean(x.rate && x.rate > 0))
      .map(({ e, rate }) => `${formatMoney(rate)} for the ${e.name}`),
  );
}

export function resolveFaq(experiences: PublicExperience[], entries: FaqEntry[] = FAQ): FaqEntry[] {
  const tokens: Record<string, string> = {
    cancellation: cancellationPhrase(experiences),
    prices: pricesPhrase(experiences),
    capacity: capacityPhrase(experiences),
    locations: locationsPhrase(experiences),
    privateRates: privateRatesPhrase(experiences),
  };
  return entries.map((f) => ({ ...f, a: f.a.replace(/\{\{(\w+)\}\}/g, (_, k: string) => tokens[k] ?? "") }));
}
