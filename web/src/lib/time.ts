/**
 * Time-zone helpers. All instants are stored as UTC; the studio runs on
 * New York time, so every "local" date/time the guest or host sees or types
 * is interpreted in BUSINESS.timeZone regardless of the server's own zone.
 */
import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";
import { BUSINESS } from "./config";

export const TZ = BUSINESS.timeZone;

/** "YYYY-MM-DD" for an instant, in business-local time. */
export function localDateKey(d: Date): string {
  return format(new TZDate(d, TZ), "yyyy-MM-dd");
}

/** Parse "YYYY-MM-DD" + "HH:mm" in business-local time → UTC Date. */
export function fromLocal(dateKey: string, time = "00:00"): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, TZ).getTime());
}

/** Day of week (0 = Sunday) of a local date key. */
export function weekdayOf(dateKey: string): number {
  return new TZDate(fromLocal(dateKey, "12:00"), TZ).getDay();
}

export function addDaysKey(dateKey: string, n: number): string {
  return localDateKey(addDays(fromLocal(dateKey, "12:00"), n));
}

/** Inclusive list of local date keys between two keys. */
export function dateRange(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  for (let k = fromKey; k <= toKey; k = addDaysKey(k, 1)) out.push(k);
  return out;
}

export function todayKey(now = new Date()): string {
  return localDateKey(now);
}

/** Format an instant in business-local time with a date-fns pattern. */
export function fmt(d: Date | string, pattern: string): string {
  return format(new TZDate(new Date(d), TZ), pattern);
}

/** "Saturday, November 14" */
export const fmtDateLong = (d: Date | string) => fmt(d, "EEEE, MMMM d");
/** "Sat, Nov 14, 2026" */
export const fmtDateShort = (d: Date | string) => fmt(d, "EEE, MMM d, yyyy");
/** "2:00 PM" → "2pm" style when on the hour */
export function fmtTime(d: Date | string): string {
  const t = new TZDate(new Date(d), TZ);
  return t.getMinutes() === 0 ? format(t, "haaa") : format(t, "h:mmaaa");
}
/** "2pm – 4pm" */
export const fmtTimeRange = (a: Date | string, b: Date | string) => `${fmtTime(a)} – ${fmtTime(b)}`;

/** "2 hours", "90 minutes", "2.5 hours" */
export function fmtDuration(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  if (minutes > 60 && minutes % 30 === 0) return `${minutes / 60} hours`;
  return `${minutes} minutes`;
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
