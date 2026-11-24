import { describe, expect, it } from "vitest";
import { canCheckIn } from "@/lib/booking/service";

// 11pm New York on Nov 14 is already Nov 15 in UTC, so this catches a UTC day comparison.
const late = new Date("2026-11-15T04:00:00Z");

describe("canCheckIn", () => {
  it("is open all day, New York time, for a confirmed booking", () => {
    expect(canCheckIn({ status: "confirmed", startAt: late }, new Date("2026-11-14T14:00:00Z"))).toBe(true);
    expect(canCheckIn({ status: "confirmed", startAt: late.toISOString() }, new Date("2026-11-15T04:30:00Z"))).toBe(true);
  });

  it("is closed on other days and for other statuses", () => {
    expect(canCheckIn({ status: "confirmed", startAt: late }, new Date("2026-11-13T14:00:00Z"))).toBe(false);
    expect(canCheckIn({ status: "confirmed", startAt: late }, new Date("2026-11-15T14:00:00Z"))).toBe(false);
    for (const status of ["completed", "no_show", "cancelled"]) expect(canCheckIn({ status, startAt: late }, late)).toBe(false);
  });
});
