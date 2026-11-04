import { describe, expect, it } from "vitest";
import { computeDaySlots } from "@/lib/booking/availability";
import { fromLocal } from "@/lib/time";

const everyDay = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), [{ start: "10:00", end: "22:00" }]]));
const exp = { schedule: everyDay, slotStepMinutes: 120, bufferMinutes: 0, leadTimeHours: 12, maxAdvanceDays: 120 };
const NOW = new Date("2026-11-04T12:00:00Z"); // 7am New York

describe("computeDaySlots", () => {
  it("offers 2-hour slots 10am–8pm New York time", () => {
    const d = computeDaySlots({ experience: exp, dateKey: "2026-11-10", durationMinutes: 120, busy: [], now: NOW });
    expect(d.slots.map((s) => s.start)).toEqual(
      ["10:00", "12:00", "14:00", "16:00", "18:00", "20:00"].map((t) => fromLocal("2026-11-10", t).toISOString()),
    );
    expect(d.slots[0].start).toBe("2026-11-10T15:00:00.000Z"); // EST = UTC-5
    expect(d.slots.every((s) => s.available)).toBe(true);
  });
  it("longer sessions must finish by closing", () => {
    const d = computeDaySlots({ experience: exp, dateKey: "2026-11-10", durationMinutes: 240, busy: [], now: NOW });
    expect(d.slots.length).toBe(5); // 10,12,2,4,6 (6pm→10pm ok)
  });
  it("blocks slots overlapping a booking or block, with buffer", () => {
    const busy = [{ start: fromLocal("2026-11-10", "12:00"), end: fromLocal("2026-11-10", "14:00"), kind: "booking" as const }];
    const d = computeDaySlots({ experience: exp, dateKey: "2026-11-10", durationMinutes: 120, busy, now: NOW });
    expect(d.slots.filter((s) => !s.available).map((s) => s.reason)).toEqual(["booked"]);
    const withBuffer = computeDaySlots({ experience: { ...exp, bufferMinutes: 30 }, dateKey: "2026-11-10", durationMinutes: 120, busy, now: NOW });
    expect(withBuffer.slots.filter((s) => !s.available).length).toBe(3);
  });
  it("enforces lead time and past times", () => {
    const d = computeDaySlots({ experience: exp, dateKey: "2026-11-04", durationMinutes: 120, busy: [], now: NOW });
    // now = 7am, lead 12h → earliest 7pm; only 8pm open
    expect(d.slots.filter((s) => s.available).length).toBe(1);
  });
  it("respects Cal.com-approved starts when provided", () => {
    const allowed = new Set([fromLocal("2026-11-10", "14:00").getTime()]);
    const d = computeDaySlots({ experience: exp, dateKey: "2026-11-10", durationMinutes: 120, busy: [], now: NOW, externalStarts: allowed });
    expect(d.slots.filter((s) => s.available).length).toBe(1);
    expect(d.slots.find((s) => !s.available)?.reason).toBe("calendar");
  });
  it("handles the DST change (Nov 1 2026 is fall-back day)", () => {
    const d = computeDaySlots({ experience: exp, dateKey: "2026-11-01", durationMinutes: 120, busy: [], now: new Date("2026-10-01T00:00:00Z") });
    expect(d.slots[0].start).toBe("2026-11-01T15:00:00.000Z"); // 10am EST
    const s = computeDaySlots({ experience: exp, dateKey: "2026-03-08", durationMinutes: 120, busy: [], now: new Date("2026-01-01T00:00:00Z") });
    expect(s.slots[0].start).toBe("2026-03-08T14:00:00.000Z"); // 10am EDT
    expect(s.slots.length).toBe(6);
  });
  it("closed days have no slots; too-far days are unavailable", () => {
    const closed = computeDaySlots({ experience: { ...exp, schedule: { "1": [{ start: "10:00", end: "22:00" }] } }, dateKey: "2026-11-10", durationMinutes: 120, busy: [], now: NOW });
    expect(closed.open).toBe(false);
    const far = computeDaySlots({ experience: { ...exp, maxAdvanceDays: 3 }, dateKey: "2026-11-10", durationMinutes: 120, busy: [], now: NOW });
    expect(far.slots.every((s) => s.reason === "too_far")).toBe(true);
  });
});
