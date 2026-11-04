/** Fills {{tokens}} in static FAQ copy from live experience data. */
import { FAQ, type FaqEntry } from "@/content/site";
import type { PublicExperience } from "@/lib/queries/public";

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

export function maxGuestsPhrase(experiences: PublicExperience[]): string {
  const small = experiences.filter((e) => e.minGuests < 5);
  if (!small.length) return "your group";
  const groups = [...groupBy(small, (e) => e.maxGuests).entries()];
  return listJoin(groups.map(([n, es]) => `up to ${n} guests for ${listJoin(es.map(lower))}`));
}

export function resolveFaq(experiences: PublicExperience[], entries: FaqEntry[] = FAQ): FaqEntry[] {
  const tokens: Record<string, string> = {
    cancellation: cancellationPhrase(experiences),
    maxGuests: maxGuestsPhrase(experiences),
  };
  return entries.map((f) => ({ ...f, a: f.a.replace(/\{\{(\w+)\}\}/g, (_, k: string) => tokens[k] ?? "") }));
}
