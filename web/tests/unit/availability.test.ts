import { describe, expect, it } from "vitest";
import { computeDaySlots } from "@/lib/booking/availability";
import { fromLocal } from "@/lib/time";

const everyDay = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), [{ start: "10:00", end: "22:00" }]]));
const exp = { schedule: everyDay, slotStepMinutes: 120, bufferMinutes: 0, leadTimeHours: 12, maxAdvanceDays: 120 };
const NOW = new Date("2026-11-04T12:00:00Z"); // 7am New York

describe("computeDaySlots", () => {
  it("offers 2-hour slots up to a 10pm last start, New York time", () => {
    const d = computeDaySlots({ experience: exp, dateKey: "2026-11-10", durationMinutes: 120, busy: [], now: NOW });
    expect(d.slots.map((s) => s.start)).toEqual(
      ["10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"].map((t) => fromLocal("2026-11-10", t).toISOString()),
    );
    expect(d.slots[0].start).toBe("2026-11-10T15:00:00.000Z"); // EST = UTC-5
    expect(d.slots.every((s) => s.available)).toBe(true);
  });
  it("the last start time is inclusive and sessions may run past it", () => {
    const d = computeDaySlots({ experience: exp, dateKey: "2026-11-10", durationMinutes: 240, busy: [], now: NOW });
    expect(d.slots.length).toBe(7); // 10am … 10pm, the 10pm session ends 2am
    const quarter = computeDaySlots({ experience: { ...exp, slotStepMinutes: 15 }, dateKey: "2026-11-10", durationMinutes: 120, busy: [], now: NOW });
    expect(quarter.slots.at(-1)?.start).toBe(fromLocal("2026-11-10", "22:00").toISOString()); // no 10:15
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
    // now = 7am, lead 12h → earliest 7pm; 8pm and 10pm open
    expect(d.slots.filter((s) => s.available).length).toBe(2);
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
    expect(s.slots.length).toBe(7);
  });
  it("closed days have no slots; too-far days are unavailable", () => {
    const closed = computeDaySlots({ experience: { ...exp, schedule: { "1": [{ start: "10:00", end: "22:00" }] } }, dateKey: "2026-11-10", durationMinutes: 120, busy: [], now: NOW });
    expect(closed.open).toBe(false);
    const far = computeDaySlots({ experience: { ...exp, maxAdvanceDays: 3 }, dateKey: "2026-11-10", durationMinutes: 120, busy: [], now: NOW });
    expect(far.slots.every((s) => s.reason === "too_far")).toBe(true);
  });
  it("shares a session: same experience and start time fills seats instead of blocking", () => {
    const shared = { ...exp, id: "prod", minGuests: 1, maxGuests: 15 };
    const at = (t: string, guests: number, experienceId = "prod", hours = 2) => ({
      start: fromLocal("2026-11-10", t),
      end: new Date(fromLocal("2026-11-10", t).getTime() + hours * 3600_000),
      kind: "booking" as const,
      experienceId,
      guests,
    });
    const slot = (busy: ReturnType<typeof at>[], guests?: number) =>
      computeDaySlots({ experience: shared, dateKey: "2026-11-10", durationMinutes: 120, busy, now: NOW, guests }).slots[1]; // 12:00

    expect(slot([at("12:00", 4), at("12:00", 6)])).toMatchObject({ available: true, seatsLeft: 5 });
    expect(slot([at("12:00", 15)])).toMatchObject({ available: false, reason: "booked" });
    expect(slot([at("12:00", 12)], 4)).toMatchObject({ available: false, reason: "booked" }); // 3 seats, party of 4
    expect(slot([at("12:00", 12)], 3)).toMatchObject({ available: true, seatsLeft: 3 });
    // Another experience, or the same one at another start, still takes the host.
    expect(slot([at("12:00", 2, "dj")])).toMatchObject({ available: false, reason: "booked" });
    expect(slot([at("10:00", 2, "prod", 3)])).toMatchObject({ available: false, reason: "booked" });
    // An untouched session reports no seat count, and a minimum party needs room for the whole party.
    expect(slot([]).seatsLeft).toBeUndefined();
    const meditation = { ...shared, id: "med", minGuests: 6 };
    const med = computeDaySlots({ experience: meditation, dateKey: "2026-11-10", durationMinutes: 120, busy: [at("12:00", 12, "med")], now: NOW });
    expect(med.slots[1]).toMatchObject({ available: false, reason: "booked" });
  });
  it("a session other guests already joined skips the outside calendar check", () => {
    const shared = { ...exp, id: "prod", minGuests: 1, maxGuests: 15 };
    const start = fromLocal("2026-11-10", "12:00");
    const busy = [{ start, end: new Date(start.getTime() + 2 * 3600_000), kind: "booking" as const, experienceId: "prod", guests: 2 }];
    const d = computeDaySlots({ experience: shared, dateKey: "2026-11-10", durationMinutes: 120, busy, now: NOW, externalStarts: new Set<number>() });
    expect(d.slots.filter((s) => s.available).map((s) => s.start)).toEqual([start.toISOString()]);
  });
  it("private bookings require a completely empty slot and block shared bookings", () => {
    const shared = { ...exp, id: "prod", minGuests: 1, maxGuests: 15 };
    const start = fromLocal("2026-11-10", "12:00");
    const end = new Date(start.getTime() + 2 * 3600_000);
    // An existing shared booking blocks a private booking on that slot
    const sharedBusy = [{ start, end, kind: "booking" as const, experienceId: "prod", guests: 2, isPrivate: false }];
    const privAttempt = computeDaySlots({ experience: shared, dateKey: "2026-11-10", durationMinutes: 120, busy: sharedBusy, now: NOW, guests: 2, isPrivate: true });
    expect(privAttempt.slots[1]).toMatchObject({ available: false, reason: "booked" });
    expect(privAttempt.slots[0]).toMatchObject({ available: true });
    expect(privAttempt.slots[0].seatsLeft).toBeUndefined();

    // An existing private booking blocks a shared booking on that slot even with seats left
    const privBusy = [{ start, end, kind: "booking" as const, experienceId: "prod", guests: 2, isPrivate: true }];
    const sharedAttempt = computeDaySlots({ experience: shared, dateKey: "2026-11-10", durationMinutes: 120, busy: privBusy, now: NOW, guests: 1, isPrivate: false });
    expect(sharedAttempt.slots[1]).toMatchObject({ available: false, reason: "booked" });

    // Private meditation with 2 guests succeeds on an empty slot despite shared minGuests=6
    const meditation = { ...shared, id: "med", minGuests: 6 };
    const privMed = computeDaySlots({ experience: meditation, dateKey: "2026-11-10", durationMinutes: 120, busy: [], now: NOW, guests: 2, isPrivate: true });
    expect(privMed.slots[1]).toMatchObject({ available: true });
  });
});
