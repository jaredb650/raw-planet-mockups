/**
 * Availability engine.
 *
 * A start time is bookable when ALL of these hold:
 *   1. it falls inside the experience's weekly schedule (business-local time)
 *      and the whole session ends before the window closes;
 *   2. it respects lead time (min notice) and the max-advance window;
 *   3. it doesn't overlap (incl. buffer) any confirmed booking, live checkout
 *      hold, manual block, or imported calendar busy time in the same
 *      resource group (one host = one calendar);
 *   4. when Cal.com is connected, Cal.com also offers it — Cal.com checks the
 *      shared Google Calendar, which Airbnb Experiences syncs into.
 */
import "server-only";
import { and, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import { getDb, type DB, type Tx } from "@/lib/db";
import { blocks, bookings, experiences, type Experience } from "@/lib/db/schema";
import { calAvailableStarts } from "@/lib/integrations/calcom";
import { addDaysKey, dateRange, fromLocal, localDateKey, overlaps, weekdayOf } from "@/lib/time";

export type Interval = { start: Date; end: Date; kind?: "booking" | "hold" | "block" };

export type Slot = {
  start: string; // ISO
  end: string; // ISO
  available: boolean;
  reason?: "past" | "notice" | "booked" | "blocked" | "calendar" | "too_far";
};

export type DayAvailability = { date: string; open: boolean; slots: Slot[] };

type ScheduleExperience = Pick<
  Experience,
  "schedule" | "slotStepMinutes" | "bufferMinutes" | "leadTimeHours" | "maxAdvanceDays"
>;

/** Pure: candidate slots for one local day given busy intervals. Unit-tested. */
export function computeDaySlots(opts: {
  experience: ScheduleExperience;
  dateKey: string;
  durationMinutes: number;
  busy: Interval[];
  now: Date;
  /** Cal.com-approved starts (epoch ms). null = Cal.com not in use. */
  externalStarts?: Set<number> | null;
}): DayAvailability {
  const { experience: e, dateKey, durationMinutes, busy, now } = opts;
  const windows = e.schedule[String(weekdayOf(dateKey))] ?? [];
  const slots: Slot[] = [];
  const earliest = new Date(now.getTime() + e.leadTimeHours * 3600_000);
  const latestDay = addDaysKey(localDateKey(now), e.maxAdvanceDays);
  const bufferMs = e.bufferMinutes * 60_000;
  const step = Math.max(15, e.slotStepMinutes);

  for (const w of windows) {
    const winStart = fromLocal(dateKey, w.start);
    const winEnd = fromLocal(dateKey, w.end);
    for (let t = winStart.getTime(); t + durationMinutes * 60_000 <= winEnd.getTime(); t += step * 60_000) {
      const start = new Date(t);
      const end = new Date(t + durationMinutes * 60_000);
      let reason: Slot["reason"];
      if (start <= now) reason = "past";
      else if (start < earliest) reason = "notice";
      else if (dateKey > latestDay) reason = "too_far";
      else {
        const hit = busy.find((b) =>
          overlaps(new Date(start.getTime() - bufferMs), new Date(end.getTime() + bufferMs), b.start, b.end),
        );
        if (hit) reason = hit.kind === "block" ? "blocked" : "booked";
        else if (opts.externalStarts && !opts.externalStarts.has(start.getTime())) reason = "calendar";
      }
      slots.push({ start: start.toISOString(), end: end.toISOString(), available: !reason, ...(reason ? { reason } : {}) });
    }
  }
  return { date: dateKey, open: windows.length > 0, slots };
}

/** Busy intervals for a resource group in [from, to). Optionally ignore one booking (for reschedules). */
export async function loadBusy(
  db: DB | Tx,
  opts: { resourceGroup: string; experienceId?: string; from: Date; to: Date; ignoreBookingId?: string; now?: Date },
): Promise<Interval[]> {
  const now = opts.now ?? new Date();
  const rows = await db
    .select({
      id: bookings.id,
      startAt: bookings.startAt,
      endAt: bookings.endAt,
      status: bookings.status,
      holdExpiresAt: bookings.holdExpiresAt,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.resourceGroup, opts.resourceGroup),
        lt(bookings.startAt, opts.to),
        gt(bookings.endAt, opts.from),
        or(
          inArray(bookings.status, ["confirmed", "completed"]),
          and(eq(bookings.status, "pending_payment"), gt(bookings.holdExpiresAt, now)),
        ),
      ),
    );
  const blockRows = await db
    .select({ startAt: blocks.startAt, endAt: blocks.endAt })
    .from(blocks)
    .where(
      and(
        eq(blocks.resourceGroup, opts.resourceGroup),
        lt(blocks.startAt, opts.to),
        gt(blocks.endAt, opts.from),
        opts.experienceId ? or(isNull(blocks.experienceId), eq(blocks.experienceId, opts.experienceId)) : isNull(blocks.experienceId),
      ),
    );
  return [
    ...rows
      .filter((r) => r.id !== opts.ignoreBookingId)
      .map((r) => ({ start: r.startAt, end: r.endAt, kind: r.status === "pending_payment" ? ("hold" as const) : ("booking" as const) })),
    ...blockRows.map((b) => ({ start: b.startAt, end: b.endAt, kind: "block" as const })),
  ];
}

export async function getExperienceBySlugOrId(db: DB | Tx, idOrSlug: string): Promise<Experience | undefined> {
  const [row] = await db
    .select()
    .from(experiences)
    .where(or(eq(experiences.id, idOrSlug), eq(experiences.slug, idOrSlug)))
    .limit(1);
  return row;
}

/**
 * Availability for a range of local days. Used by the public booking widget
 * (GET /api/availability) and the admin reschedule picker.
 */
export async function getAvailability(opts: {
  experience: Experience;
  fromKey: string;
  toKey: string;
  durationMinutes: number;
  ignoreBookingId?: string;
  now?: Date;
}): Promise<{ days: DayAvailability[]; calendarError?: boolean }> {
  const db = await getDb();
  const now = opts.now ?? new Date();
  const from = fromLocal(opts.fromKey, "00:00");
  const to = fromLocal(addDaysKey(opts.toKey, 1), "00:00");
  const busy = await loadBusy(db, {
    resourceGroup: opts.experience.resourceGroup,
    experienceId: opts.experience.id,
    from: new Date(from.getTime() - 6 * 3600_000),
    to: new Date(to.getTime() + 6 * 3600_000),
    ignoreBookingId: opts.ignoreBookingId,
    now,
  });

  let externalStarts: Set<number> | null = null;
  let calendarError = false;
  if (opts.experience.calEventTypeId) {
    try {
      externalStarts = await calAvailableStarts({
        eventTypeId: opts.experience.calEventTypeId,
        start: from,
        end: to,
        durationMinutes: opts.durationMinutes,
      });
    } catch {
      // Cal.com unreachable: show local availability; the slot reservation at
      // checkout re-checks with Cal.com before any payment is taken.
      calendarError = true;
    }
  }

  const days = dateRange(opts.fromKey, opts.toKey).map((dateKey) =>
    computeDaySlots({ experience: opts.experience, dateKey, durationMinutes: opts.durationMinutes, busy, now, externalStarts }),
  );
  return { days, ...(calendarError ? { calendarError } : {}) };
}

/** Re-check a single slot inside a transaction (call after taking the advisory lock). */
export async function isSlotFree(
  tx: Tx,
  opts: { experience: Experience; start: Date; durationMinutes: number; ignoreBookingId?: string; now?: Date; skipNotice?: boolean },
): Promise<{ ok: true } | { ok: false; reason: NonNullable<Slot["reason"]> | "outside_hours" }> {
  const now = opts.now ?? new Date();
  const dateKey = localDateKey(opts.start);
  const busy = await loadBusy(tx, {
    resourceGroup: opts.experience.resourceGroup,
    experienceId: opts.experience.id,
    from: new Date(opts.start.getTime() - 24 * 3600_000),
    to: new Date(opts.start.getTime() + 24 * 3600_000),
    ignoreBookingId: opts.ignoreBookingId,
    now,
  });
  const exp = opts.skipNotice ? { ...opts.experience, leadTimeHours: 0, maxAdvanceDays: 3650 } : opts.experience;
  const day = computeDaySlots({ experience: exp, dateKey, durationMinutes: opts.durationMinutes, busy, now });
  const slot = day.slots.find((s) => new Date(s.start).getTime() === opts.start.getTime());
  if (!slot) return { ok: false, reason: "outside_hours" };
  if (!slot.available) return { ok: false, reason: slot.reason ?? "booked" };
  return { ok: true };
}
