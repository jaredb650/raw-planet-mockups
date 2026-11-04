/**
 * Calendar-grid arithmetic on "YYYY-MM-DD" / "YYYY-MM" keys. Pure string/UTC
 * math so it never depends on the browser's time zone; "today" comes from
 * the New York helpers in lib/time.
 */
import { fmt, todayKey } from "@/lib/time";

export type MonthKey = string; // "YYYY-MM"

export const monthOf = (dateKey: string): MonthKey => dateKey.slice(0, 7);

function utc(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00Z`);
}
const keyOf = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(dateKey: string, n: number): string {
  const d = utc(dateKey);
  d.setUTCDate(d.getUTCDate() + n);
  return keyOf(d);
}

export function addMonths(month: MonthKey, n: number): MonthKey {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1, 12));
  return keyOf(d).slice(0, 7);
}

export function firstOfMonth(month: MonthKey): string {
  return `${month}-01`;
}

export function lastOfMonth(month: MonthKey): string {
  const [y, m] = month.split("-").map(Number);
  return keyOf(new Date(Date.UTC(y, m, 0, 12)));
}

/** Monday-first weeks covering the month; null = padding cell. */
export function monthGrid(month: MonthKey): (string | null)[][] {
  const first = firstOfMonth(month);
  const last = lastOfMonth(month);
  const offset = (utc(first).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let k = first; k <= last; k = addDays(k, 1)) cells.push(k);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** "Saturday, November 14" for a date key (noon NY avoids DST edges). */
export function longDate(dateKey: string): string {
  return fmt(new Date(`${dateKey}T17:00:00Z`), "EEEE, MMMM d");
}
export function shortDate(dateKey: string): string {
  return fmt(new Date(`${dateKey}T17:00:00Z`), "EEE, MMM d");
}
export function monthLabel(month: MonthKey): string {
  return fmt(new Date(`${month}-15T17:00:00Z`), "MMMM yyyy");
}

export { todayKey };
