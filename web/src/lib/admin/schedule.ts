import { addDaysKey, fromLocal, weekdayOf } from "@/lib/time";

/**
 * Time ranges for an admin "block time" entry. All-day blocks run to midnight after the last day.
 * Repeats shift by local days so each week keeps its wall-clock time across DST.
 */
export function blockSpans(o: { startDate: string; endDate: string; startTime: string; endTime: string; allDay: boolean; repeatWeeks: number }) {
  const out: { s: Date; e: Date }[] = [];
  for (let i = 0; i <= o.repeatWeeks; i++) {
    out.push({
      s: fromLocal(addDaysKey(o.startDate, i * 7), o.allDay ? "00:00" : o.startTime),
      e: fromLocal(addDaysKey(o.endDate, i * 7 + (o.allDay ? 1 : 0)), o.allDay ? "00:00" : o.endTime),
    });
  }
  return out;
}

/** Dates for an event series. Monthly = same weekday in the same week of the month ("2nd Thursday"); months without that week are skipped. */
export function seriesDates(first: string, repeat: "none" | "weekly" | "biweekly" | "monthly", count: number): string[] {
  if (repeat === "none") return [first];
  if (repeat !== "monthly") return Array.from({ length: count }, (_, i) => addDaysKey(first, (repeat === "weekly" ? 7 : 14) * i));
  const nth = Math.floor((Number(first.slice(8, 10)) - 1) / 7);
  const wd = weekdayOf(first);
  const [y, m] = first.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const mm = new Date(Date.UTC(y, m - 1 + i, 1));
    const monthStart = `${mm.getUTCFullYear()}-${String(mm.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const day = addDaysKey(monthStart, ((wd - weekdayOf(monthStart) + 7) % 7) + 7 * nth);
    if (day.slice(0, 7) === monthStart.slice(0, 7)) out.push(day);
  }
  return out;
}
