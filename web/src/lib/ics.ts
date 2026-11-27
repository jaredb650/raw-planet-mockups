/** Minimal RFC 5545 iCalendar writer and parser (bookings, events, and host feeds). */
import { TZDate } from "@date-fns/tz";
import { BUSINESS } from "@/lib/config";
import { addDaysKey } from "@/lib/time";

export type IcsEvent = {
  uid: string;
  start: Date;
  end: Date;
  dtstamp?: Date;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  status?: "CONFIRMED" | "CANCELLED" | "TENTATIVE";
  sequence?: number;
};

const esc = (s: string) =>
  s
    .replace(/\r\n?/g, "\n")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

const unesc = (s: string) =>
  s.replace(/\\([\\,;nN])/g, (_, ch: string) => (ch === "n" || ch === "N" ? "\n" : ch));

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Fold lines to 75 octets as required by RFC 5545 without splitting UTF-16 surrogate pairs. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = Math.min(75, rest.length);
    while (cut > 0 && Buffer.byteLength(rest.slice(0, cut)) > 75) cut--;
    // Never split a UTF-16 surrogate pair across folded lines.
    if (cut > 0 && cut < rest.length) {
      const code = rest.charCodeAt(cut - 1);
      if (code >= 0xd800 && code <= 0xdbff) cut--;
    }
    if (cut <= 0) cut = 1;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildIcs(
  events: IcsEvent[],
  opts: { name?: string; method?: "PUBLISH" | "REQUEST" | "CANCEL"; timeZone?: string } = {},
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${BUSINESS.name}//Bookings//EN`,
    "CALSCALE:GREGORIAN",
    `METHOD:${opts.method ?? "PUBLISH"}`,
    ...(opts.name ? [`X-WR-CALNAME:${esc(opts.name)}`] : []),
    ...(opts.timeZone ? [`X-WR-TIMEZONE:${esc(opts.timeZone)}`] : []),
  ];
  const now = stamp(new Date());
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${e.dtstamp ? stamp(e.dtstamp) : now}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end)}`,
      `SUMMARY:${esc(e.summary)}`,
      ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
      ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
      ...(e.url ? [`URL:${e.url}`] : []),
      `STATUS:${e.status ?? "CONFIRMED"}`,
      `SEQUENCE:${e.sequence ?? 0}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Google Calendar "add event" link. */
export function googleCalendarUrl(e: { start: Date; end: Date; summary: string; description?: string; location?: string }): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.summary,
    dates: `${stamp(e.start)}/${stamp(e.end)}`,
    ...(e.description ? { details: e.description } : {}),
    ...(e.location ? { location: e.location } : {}),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

const WINDOWS_TZ: Record<string, string> = {
  "eastern standard time": "America/New_York",
  "us eastern standard time": "America/New_York",
  "central standard time": "America/Chicago",
  "mountain standard time": "America/Denver",
  "pacific standard time": "America/Los_Angeles",
  "atlantic standard time": "America/Halifax",
  "gmt standard time": "Europe/London",
  "greenwich standard time": "UTC",
  "w. europe standard time": "Europe/Berlin",
  "central europe standard time": "Europe/Budapest",
  "romance standard time": "Europe/Paris",
  utc: "UTC",
};

function normalizeTz(raw?: string): string {
  if (!raw) return BUSINESS.timeZone;
  const cleaned = raw.trim().replace(/^["']|["']$/g, "");
  if (!cleaned) return BUSINESS.timeZone;
  return WINDOWS_TZ[cleaned.toLowerCase()] ?? cleaned;
}

/** Parse RFC 5545 ISO-8601 DURATION (e.g. PT1H30M, P1D, P1W) to milliseconds. */
function parseIcsDurationMs(value: string): number | null {
  const m = value.trim().match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!m) return null;
  if (!m[2] && !m[3] && !m[4] && !m[5] && !m[6]) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const secs =
    Number(m[2] ?? 0) * 7 * 86400 +
    Number(m[3] ?? 0) * 86400 +
    Number(m[4] ?? 0) * 3600 +
    Number(m[5] ?? 0) * 60 +
    Number(m[6] ?? 0);
  return sign * secs * 1000;
}

/**
 * Tiny iCal reader for importing busy times (Airbnb/Viator/other calendars).
 * Handles folded lines, VALARM blocks, UTC/TZID/Windows-TZID/all-day DTSTART/DTEND,
 * and DURATION; ignores RRULEs (booking platforms list each occurrence explicitly).
 */
export function parseIcsBusy(text: string): { uid: string; start: Date; end: Date; summary: string; cancelled: boolean }[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const out: { uid: string; start: Date; end: Date; summary: string; cancelled: boolean }[] = [];
  for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const rawBody = block.split("END:VEVENT")[0] ?? "";
    // Strip nested VALARM blocks so alarm DURATION/SUMMARY/TRIGGER never shadow VEVENT properties.
    const body = rawBody.replace(/BEGIN:VALARM[\s\S]*?END:VALARM/gi, "");
    const get = (key: string) => {
      const m = body.match(new RegExp(`^${key}(;[^:\\r\\n]*)?:(.*)$`, "im"));
      return m ? { params: m[1] ?? "", value: m[2].trim() } : null;
    };
    const ds = get("DTSTART");
    if (!ds) continue;
    const de = get("DTEND");
    const dur = get("DURATION");
    const start = parseIcsDate(ds.value, ds.params);
    if (Number.isNaN(start.getTime())) continue;

    const isAllDay = /^\d{8}$/.test(ds.value);
    let end: Date;
    if (de) {
      end = parseIcsDate(de.value, de.params);
      if (isAllDay && !Number.isNaN(end.getTime()) && end.getTime() <= start.getTime()) {
        // Some feeds emit DTSTART === DTEND for a single all-day block.
        const nextDay = addDaysKey(`${ds.value.slice(0, 4)}-${ds.value.slice(4, 6)}-${ds.value.slice(6, 8)}`, 1);
        end = zonedToUtc(Number(nextDay.slice(0, 4)), Number(nextDay.slice(5, 7)), Number(nextDay.slice(8, 10)), 0, 0, 0, BUSINESS.timeZone);
      }
    } else if (dur) {
      const ms = parseIcsDurationMs(dur.value);
      end = ms && ms > 0 ? new Date(start.getTime() + ms) : new Date(start.getTime() + 3600_000);
    } else if (isAllDay) {
      const nextDay = addDaysKey(`${ds.value.slice(0, 4)}-${ds.value.slice(4, 6)}-${ds.value.slice(6, 8)}`, 1);
      end = zonedToUtc(Number(nextDay.slice(0, 4)), Number(nextDay.slice(5, 7)), Number(nextDay.slice(8, 10)), 0, 0, 0, BUSINESS.timeZone);
    } else {
      end = new Date(start.getTime() + 3600_000);
    }
    if (Number.isNaN(end.getTime()) || end <= start) continue;

    out.push({
      uid: get("UID")?.value ?? `${start.toISOString()}-${end.toISOString()}`,
      start,
      end,
      summary: unesc(get("SUMMARY")?.value ?? "Busy"),
      cancelled: (get("STATUS")?.value ?? "").toUpperCase() === "CANCELLED" || (get("TRANSP")?.value ?? "").toUpperCase() === "TRANSPARENT",
    });
  }
  return out;
}

function parseIcsDate(value: string, params: string): Date {
  if (/^\d{8}$/.test(value)) {
    const y = Number(value.slice(0, 4));
    const mo = Number(value.slice(4, 6));
    const d = Number(value.slice(6, 8));
    return zonedToUtc(y, mo, d, 0, 0, 0, BUSINESS.timeZone);
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/i);
  if (!m) return new Date(NaN);
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const H = Number(m[4]), M = Number(m[5]), S = Number(m[6]);
  if (m[7]?.toUpperCase() === "Z") return new Date(Date.UTC(y, mo - 1, d, H, M, S));
  const rawTz = params.match(/TZID=([^;:]+)/i)?.[1];
  const tz = normalizeTz(rawTz);
  return zonedToUtc(y, mo, d, H, M, S, tz);
}

function zonedToUtc(y: number, mo: number, d: number, H: number, M: number, S: number, timeZone: string): Date {
  try {
    return new Date(new TZDate(y, mo - 1, d, H, M, S, timeZone).getTime());
  } catch {
    return new Date(new TZDate(y, mo - 1, d, H, M, S, BUSINESS.timeZone).getTime());
  }
}
