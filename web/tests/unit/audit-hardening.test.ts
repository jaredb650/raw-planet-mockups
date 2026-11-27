import { describe, expect, it } from "vitest";
import { dateRange, isValidDateKey } from "@/lib/time";
import { buildIcs, parseIcsBusy } from "@/lib/ics";
import { isPrivateIp } from "@/lib/feeds";
import { isSafeHttpUrl } from "@/app/api/_lib/http";
import { unsubToken, unsubTokenValid } from "@/lib/unsubscribe-token";
import { computeDaySlots } from "@/lib/booking/availability";

describe("isValidDateKey and dateRange DoS guard", () => {
  it("accepts real calendar dates and rejects impossible or extreme years", () => {
    expect(isValidDateKey("2026-02-28")).toBe(true);
    expect(isValidDateKey("2024-02-29")).toBe(true);
    expect(isValidDateKey("2026-02-29")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("9999-10-31")).toBe(false);
    expect(isValidDateKey("0000-01-01")).toBe(false);
    expect(isValidDateKey("not-a-date")).toBe(false);
  });

  it("terminates immediately on year-9999 wrap, inverted ranges, and excessive spans", () => {
    expect(dateRange("9999-10-31", "9999-12-31")).toHaveLength(62);
    expect(dateRange("2026-01-01", "2029-01-01")).toHaveLength(400);
    expect(dateRange("2026-05-10", "2026-05-05")).toEqual([]);
    expect(dateRange("2026-05-01", "2026-05-03")).toEqual(["2026-05-01", "2026-05-02", "2026-05-03"]);
  });
});

describe("SSRF IPv6 hardening", () => {
  it("blocks hex IPv4-mapped IPv6 and full fe80::/10 link-local range", () => {
    for (const ip of [
      "::ffff:a9fe:a9fe", // 169.254.169.254 AWS/GCP metadata
      "::ffff:7f00:1", // 127.0.0.1
      "::ffff:0a00:0001", // 10.0.0.1
      "::ffff:c0a8:0101", // 192.168.1.1
      "::ffff:ac10:0001", // 172.16.0.1
      "fe90::1",
      "fea0::1234",
      "febf::ffff",
      "0:0:0:0:0:0:0:1",
      "0:0:0:0:0:0:0:0",
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
    expect(isPrivateIp("::ffff:0808:0808")).toBe(false); // 8.8.8.8
    expect(isPrivateIp("fec0::1")).toBe(false);
  });
});

describe("isSafeHttpUrl", () => {
  it("allows http/https and rejects javascript/data/protocol-relative schemes", () => {
    expect(isSafeHttpUrl("https://rawplanetexperiences.com/track")).toBe(true);
    expect(isSafeHttpUrl("http://example.com")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeHttpUrl("//evil.example/x")).toBe(false);
    expect(isSafeHttpUrl("mailto:test@example.com")).toBe(false);
  });
});

describe("HMAC token verification with multi-byte UTF-8 input", () => {
  it("never throws RangeError on multi-byte inputs of equal char length", () => {
    const cid = "00000000-0000-4000-8000-000000000001";
    const uTok = unsubToken(cid);
    expect(unsubTokenValid(cid, uTok)).toBe(true);
    expect(unsubTokenValid(cid, "é".repeat(uTok.length))).toBe(false);
    expect(unsubTokenValid(cid, "🎵".repeat(uTok.length / 2))).toBe(false);
  });
});

describe("ICS hardening", () => {
  const cal = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}END:VCALENDAR\r\n`;
  const vevent = (lines: string[]) => `BEGIN:VEVENT\r\n${lines.join("\r\n")}\r\nEND:VEVENT\r\n`;

  it("maps quoted Windows TZIDs, strips VALARM, supports DURATION, and unescapes SUMMARY", () => {
    const raw = cal(
      vevent([
        "UID:win-1",
        'DTSTART;TZID="Eastern Standard Time":20260710T100000',
        "DURATION:PT1H30M",
        "SUMMARY:Studio\\, Mix\\; \\\\ Test",
        "BEGIN:VALARM",
        "TRIGGER:-PT15M",
        "DURATION:PT5M",
        "END:VALARM",
      ]),
    );
    const [e] = parseIcsBusy(raw);
    expect(e.start.toISOString()).toBe("2026-07-10T14:00:00.000Z"); // EDT (UTC-4)
    expect(e.end.toISOString()).toBe("2026-07-10T15:30:00.000Z");
    expect(e.summary).toBe("Studio, Mix; \\ Test");
  });

  it("handles all-day events with DTSTART === DTEND and DST fall-back day without DTEND", () => {
    const [same] = parseIcsBusy(cal(vevent(["UID:same", "DTSTART;VALUE=DATE:20260710", "DTEND;VALUE=DATE:20260710"])));
    expect(same.start.toISOString()).toBe("2026-07-10T04:00:00.000Z");
    expect(same.end.toISOString()).toBe("2026-07-11T04:00:00.000Z");

    // Nov 1, 2026 is a 25-hour DST fall-back day in America/New_York
    const [dst] = parseIcsBusy(cal(vevent(["UID:dst", "DTSTART;VALUE=DATE:20261101"])));
    expect(dst.start.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(dst.end.toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });

  it("emits METHOD:CANCEL, X-WR-TIMEZONE, deterministic DTSTAMP, strips CR, and never splits surrogate pairs", () => {
    const out = buildIcs(
      [
        {
          uid: "cancel-1@rawplanetexperiences.com",
          start: new Date("2026-11-14T19:00:00Z"),
          end: new Date("2026-11-14T21:00:00Z"),
          summary: "Session\r\nInjected",
          description: "🎧".repeat(40),
          status: "CANCELLED",
          dtstamp: new Date("2026-11-10T12:00:00Z"),
        },
      ],
      { name: "Raw Planet", method: "CANCEL", timeZone: "America/New_York" },
    );
    expect(out).toContain("METHOD:CANCEL\r\n");
    expect(out).toContain("X-WR-TIMEZONE:America/New_York\r\n");
    expect(out).toContain("DTSTAMP:20261110T120000Z\r\n");
    expect(out).toContain("SUMMARY:Session\\nInjected\r\n");
    const unfolded = out.replace(/\r\n[ \t]/g, "");
    expect(unfolded).toContain("🎧".repeat(40));
    for (const line of out.split("\r\n")) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
      expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(line)).toBe(false);
    }
  });
});

describe("availability per_session exclusivity and symmetric buffer", () => {
  const baseExp: Parameters<typeof computeDaySlots>[0]["experience"] = {
    id: "exp-1",
    pricingMode: "per_session",
    schedule: { "5": [{ start: "10:00", end: "18:00" }] }, // Friday
    slotStepMinutes: 60,
    bufferMinutes: 0,
    leadTimeHours: 0,
    maxAdvanceDays: 180,
    minGuests: 1,
    maxGuests: 6,
  };

  it("blocks sharing on per_session bookings and enforces existing booking's bufferMinutes symmetrically", () => {
    // Friday 2026-07-10 12:00-14:00 EDT = 16:00-18:00Z (with 30m buffer from another experience)
    const day = computeDaySlots({
      experience: baseExp,
      dateKey: "2026-07-10",
      durationMinutes: 120,
      guests: 1,
      now: new Date("2026-07-01T12:00:00Z"),
      busy: [
        {
          start: new Date("2026-07-10T16:00:00Z"),
          end: new Date("2026-07-10T18:00:00Z"),
          experienceId: "exp-1",
          guests: 2,
          isPrivate: false,
          bufferMinutes: 30,
        },
      ],
    });
    const avail = day.slots.filter((s) => s.available).map((s) => s.start);
    // 10:00 EDT (14:00Z) touches 12:00 with 0 gap (< 30m existing buffer), so blocked!
    expect(avail).not.toContain("2026-07-10T14:00:00.000Z");
    // 12:00 EDT (16:00Z) is per_session -> exclusive even though guests < maxGuests, so blocked!
    expect(avail).not.toContain("2026-07-10T16:00:00.000Z");
    // 14:00 EDT (18:00Z) starts 0m after 14:00 (< 30m existing buffer), so blocked!
    expect(avail).not.toContain("2026-07-10T18:00:00.000Z");
    // 15:00 EDT (19:00Z) starts 60m after 14:00 (>= 30m buffer), so available!
    expect(avail).toContain("2026-07-10T19:00:00.000Z");
  });
});
