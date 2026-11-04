import { describe, expect, it } from "vitest";
import { buildIcs, parseIcsBusy } from "@/lib/ics";

const unfold = (s: string) => s.replace(/\r\n[ \t]/g, "");

describe("buildIcs", () => {
  const ev = {
    uid: "b1@rawplanetexperiences.com",
    start: new Date("2026-11-14T19:00:00Z"),
    end: new Date("2026-11-14T21:00:00Z"),
    summary: "Music Production; Raw Planet, NYC",
    description: "Line one\nback\\slash; semi, comma",
    location: "123 Sample St, New York, NY",
  };

  it("escapes ; , \\ and newlines per RFC 5545", () => {
    const out = unfold(buildIcs([ev]));
    expect(out).toContain("SUMMARY:Music Production\\; Raw Planet\\, NYC\r\n");
    expect(out).toContain("DESCRIPTION:Line one\\nback\\\\slash\\; semi\\, comma\r\n");
    expect(out).toContain("LOCATION:123 Sample St\\, New York\\, NY\r\n");
  });

  it("writes UTC instants, status and sequence with CRLF line endings", () => {
    const out = buildIcs([{ ...ev, status: "CANCELLED", sequence: 11 }], { name: "Raw Planet" });
    expect(out).toContain("DTSTART:20261114T190000Z\r\n");
    expect(out).toContain("DTEND:20261114T210000Z\r\n");
    expect(out).toContain("STATUS:CANCELLED\r\n");
    expect(out).toContain("SEQUENCE:11\r\n");
    expect(out).toContain("X-WR-CALNAME:Raw Planet\r\n");
    expect(out.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(out.replace(/\r\n/g, "")).not.toMatch(/\n/);
  });

  it("folds long lines at 75 octets, including multi-byte text", () => {
    const out = buildIcs([{ ...ev, description: "Sesión de producción musical — ".repeat(10) }]);
    for (const line of out.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(unfold(out)).toContain("Sesión de producción musical — Sesión");
  });

  it("round-trips through the parser", () => {
    const [p] = parseIcsBusy(buildIcs([ev]));
    expect(p.uid).toBe(ev.uid);
    expect(p.start.toISOString()).toBe(ev.start.toISOString());
    expect(p.end.toISOString()).toBe(ev.end.toISOString());
    expect(p.cancelled).toBe(false);
  });
});

const cal = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}END:VCALENDAR\r\n`;
const vevent = (lines: string[]) => `BEGIN:VEVENT\r\n${lines.join("\r\n")}\r\nEND:VEVENT\r\n`;

describe("parseIcsBusy", () => {
  it("all-day dates start at New York midnight in daylight time (EDT, UTC-4)", () => {
    const [e] = parseIcsBusy(cal(vevent(["UID:a", "DTSTART;VALUE=DATE:20260710", "DTEND;VALUE=DATE:20260711", "SUMMARY:Reserved"])));
    expect(e.start.toISOString()).toBe("2026-07-10T04:00:00.000Z");
    expect(e.end.toISOString()).toBe("2026-07-11T04:00:00.000Z");
  });

  it("all-day dates start at New York midnight in standard time (EST, UTC-5)", () => {
    const [e] = parseIcsBusy(cal(vevent(["UID:b", "DTSTART;VALUE=DATE:20261120", "DTEND;VALUE=DATE:20261121"])));
    expect(e.start.toISOString()).toBe("2026-11-20T05:00:00.000Z");
    expect(e.end.toISOString()).toBe("2026-11-21T05:00:00.000Z");
  });

  it("an all-day event spanning the DST change keeps local midnights", () => {
    const [e] = parseIcsBusy(cal(vevent(["UID:c", "DTSTART;VALUE=DATE:20261031", "DTEND;VALUE=DATE:20261102"])));
    expect(e.start.toISOString()).toBe("2026-10-31T04:00:00.000Z"); // EDT
    expect(e.end.toISOString()).toBe("2026-11-02T05:00:00.000Z"); // EST
  });

  it("an all-day event without DTEND lasts one day", () => {
    const [e] = parseIcsBusy(cal(vevent(["UID:d", "DTSTART;VALUE=DATE:20260710"])));
    expect(e.end.getTime() - e.start.getTime()).toBe(86400_000);
  });

  it("reads TZID and floating times in their zone, Z times as UTC", () => {
    const evs = parseIcsBusy(
      cal(
        vevent(["UID:tz", "DTSTART;TZID=America/Los_Angeles:20260710T090000", "DTEND;TZID=America/Los_Angeles:20260710T100000"]) +
          vevent(["UID:float", "DTSTART:20260710T090000", "DTEND:20260710T100000"]) +
          vevent(["UID:utc", "DTSTART:20260710T090000Z", "DTEND:20260710T100000Z"]),
      ),
    );
    const by = Object.fromEntries(evs.map((e) => [e.uid, e.start.toISOString()]));
    expect(by.tz).toBe("2026-07-10T16:00:00.000Z");
    expect(by.float).toBe("2026-07-10T13:00:00.000Z");
    expect(by.utc).toBe("2026-07-10T09:00:00.000Z");
  });

  it("unfolds folded lines and flags cancelled / transparent events", () => {
    const evs = parseIcsBusy(
      cal(
        vevent(["UID:x", "DTSTART:20260710T090000Z", "DTEND:20260710T100000Z", "SUMMARY:Long", " er title", "STATUS:CANCELLED"]) +
          vevent(["UID:y", "DTSTART:20260710T110000Z", "DTEND:20260710T120000Z", "TRANSP:TRANSPARENT"]) +
          vevent(["UID:z", "DTSTART:20260710T130000Z", "DTEND:20260710T140000Z"]),
      ),
    );
    expect(evs.find((e) => e.uid === "x")).toMatchObject({ summary: "Longer title", cancelled: true });
    expect(evs.find((e) => e.uid === "y")?.cancelled).toBe(true);
    expect(evs.find((e) => e.uid === "z")?.cancelled).toBe(false);
  });
});
