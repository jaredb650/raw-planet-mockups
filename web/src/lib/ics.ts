/** Minimal RFC 5545 iCalendar writer (bookings, events, and the host's export feed). */
import { BUSINESS } from "@/lib/config";

export type IcsEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  status?: "CONFIRMED" | "CANCELLED" | "TENTATIVE";
  sequence?: number;
};

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Fold lines to 75 octets as required by the spec. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut)) > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildIcs(events: IcsEvent[], opts: { name?: string; method?: "PUBLISH" | "REQUEST" | "CANCEL" } = {}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${BUSINESS.name}//Bookings//EN`,
    "CALSCALE:GREGORIAN",
    `METHOD:${opts.method ?? "PUBLISH"}`,
    ...(opts.name ? [`X-WR-CALNAME:${esc(opts.name)}`] : []),
  ];
  const now = stamp(new Date());
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${now}`,
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

/**
 * Tiny iCal reader for importing busy times (Viator/other calendars).
 * Handles folded lines, UTC/TZID/all-day DTSTART/DTEND; ignores RRULEs
 * (feeds from booking platforms list each occurrence explicitly).
 */
export function parseIcsBusy(text: string): { uid: string; start: Date; end: Date; summary: string; cancelled: boolean }[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const out: { uid: string; start: Date; end: Date; summary: string; cancelled: boolean }[] = [];
  for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT")[0];
    const get = (key: string) => {
      const m = body.match(new RegExp(`^${key}(;[^:\\r\\n]*)?:(.*)$`, "m"));
      return m ? { params: m[1] ?? "", value: m[2].trim() } : null;
    };
    const ds = get("DTSTART");
    if (!ds) continue;
    const de = get("DTEND");
    const start = parseIcsDate(ds.value, ds.params);
    const end = de ? parseIcsDate(de.value, de.params) : new Date(start.getTime() + (ds.value.length === 8 ? 86400_000 : 3600_000));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    out.push({
      uid: get("UID")?.value ?? `${start.toISOString()}-${end.toISOString()}`,
      start,
      end,
      summary: get("SUMMARY")?.value ?? "Busy",
      cancelled: (get("STATUS")?.value ?? "").toUpperCase() === "CANCELLED" || (get("TRANSP")?.value ?? "").toUpperCase() === "TRANSPARENT",
    });
  }
  return out;
}

function parseIcsDate(value: string, params: string): Date {
  if (/^\d{8}$/.test(value)) {
    // All-day: treat as the business day in New York
    const y = value.slice(0, 4), m = value.slice(4, 6), d = value.slice(6, 8);
    return zonedToUtc(`${y}-${m}-${d}T00:00:00`, BUSINESS.timeZone);
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return new Date(NaN);
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
  if (m[7] === "Z") return new Date(iso + "Z");
  const tz = params.match(/TZID=([^;:]+)/)?.[1];
  // Floating or TZID time: interpret in that zone (default New York)
  return zonedToUtc(iso, tz ?? BUSINESS.timeZone);
}

function zonedToUtc(localIso: string, timeZone: string): Date {
  const guess = new Date(localIso + "Z");
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const parts = Object.fromEntries(fmt.formatToParts(guess).map((p) => [p.type, p.value]));
  const asIfUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(guess.getTime() - (asIfUtc - guess.getTime()));
}
