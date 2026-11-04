/**
 * Cal.com → our bookings. Cal.com is the hub of the shared calendar
 * (Cal.com ⇄ Google ⇄ Airbnb), so changes made there — the host cancelling or
 * moving a session in Cal.com, a guest using Cal.com's own reschedule link, or
 * someone booking straight through Alex's Cal.com page — are mirrored here.
 *
 * These helpers deliberately do NOT call back into Cal.com (the change already
 * happened there), which is why they don't reuse cancelBooking/rescheduleBooking.
 * Echoes of changes we made ourselves are detected and ignored.
 */
import "server-only";
import { and, eq, gt, inArray, lt, ne, or, sql } from "drizzle-orm";
import { getDb, type Tx } from "@/lib/db";
import { blocks, bookings, customers, experiences, waitlist, type Booking } from "@/lib/db/schema";
import { newBookingCode, newToken } from "@/lib/ids";
import { fmtDateShort, fmtTimeRange, localDateKey } from "@/lib/time";
import { logEvent } from "./service";
import * as notify from "@/lib/email/notify";

export type CalAttendee = { name?: string; email?: string; timeZone?: string; phoneNumber?: string | null; language?: { locale?: string } | string };

export type CalPayload = {
  uid?: string;
  bookingId?: number;
  eventTypeId?: number | null;
  type?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  length?: number;
  status?: string;
  attendees?: CalAttendee[];
  responses?: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
  rescheduleUid?: string | null;
  fromReschedule?: string | null;
  cancellationReason?: string | null;
  additionalNotes?: string | null;
  description?: string | null;
};

export type CalWebhookBody = { triggerEvent?: string; createdAt?: string; payload?: CalPayload };

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function parseDate(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Our booking a Cal.com event refers to: metadata.rpBookingId first, then any of the uids. */
export async function findBookingForCal(p: CalPayload, opts: { preferUids?: boolean } = {}): Promise<Booking | undefined> {
  const db = await getDb();
  const rpId = str(p.metadata?.rpBookingId);
  const uids = [p.uid, p.rescheduleUid, p.fromReschedule].filter((u): u is string => Boolean(u));
  const byId = async () => (rpId ? (await db.select().from(bookings).where(eq(bookings.id, rpId)).limit(1))[0] : undefined);
  const byUid = async () =>
    uids.length ? (await db.select().from(bookings).where(inArray(bookings.calBookingUid, uids)).limit(1))[0] : undefined;
  return opts.preferUids ? ((await byUid()) ?? (await byId())) : ((await byId()) ?? (await byUid()));
}

async function notifyWaitlist(experienceId: string, dateKey: string) {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(waitlist)
      .where(and(eq(waitlist.experienceId, experienceId), eq(waitlist.date, dateKey)));
    for (const w of rows.filter((r) => !r.notifiedAt)) {
      await notify.sendWaitlistOpening(w.id);
      await db.update(waitlist).set({ notifiedAt: new Date() }).where(eq(waitlist.id, w.id));
    }
  } catch (err) {
    console.error("[cal-sync] waitlist notify failed", err);
  }
}

/** Other bookings/blocks overlapping [start, end) in the resource group (for host warnings). */
async function conflictsFor(tx: Tx, b: { id?: string; resourceGroup: string; experienceId: string; startAt: Date; endAt: Date }) {
  const clash = await tx
    .select({ code: bookings.code })
    .from(bookings)
    .where(
      and(
        eq(bookings.resourceGroup, b.resourceGroup),
        lt(bookings.startAt, b.endAt),
        gt(bookings.endAt, b.startAt),
        inArray(bookings.status, ["confirmed", "completed"]),
        b.id ? ne(bookings.id, b.id) : undefined,
      ),
    );
  const blockClash = await tx
    .select({ reason: blocks.reason })
    .from(blocks)
    .where(
      and(
        eq(blocks.resourceGroup, b.resourceGroup),
        lt(blocks.startAt, b.endAt),
        gt(blocks.endAt, b.startAt),
        or(sql`${blocks.experienceId} is null`, eq(blocks.experienceId, b.experienceId)),
      ),
    );
  return [...clash.map((c) => `booking ${c.code}`), ...blockClash.map((c) => `block${c.reason ? ` (${c.reason})` : ""}`)];
}

/* ------------------------------------------------------------------ */
/* BOOKING_CANCELLED                                                     */
/* ------------------------------------------------------------------ */

export async function applyCalCancellation(p: CalPayload): Promise<string> {
  const b = await findBookingForCal(p, { preferUids: true });
  if (!b) return "not ours";
  if (b.status !== "confirmed") return `already ${b.status}`;
  // A cancel for an older Cal.com booking whose time no longer matches ours is the
  // echo of a reschedule (Cal.com replaces the booking), not a real cancellation.
  const start = parseDate(p.startTime);
  if (start && start.getTime() !== b.startAt.getTime()) return "stale cancel (time differs)";
  if (p.uid && b.calBookingUid && p.uid !== b.calBookingUid && !str(p.metadata?.rpBookingId)) return "stale cancel (uid differs)";

  const db = await getDb();
  const reason = str(p.cancellationReason);
  const [u] = await db
    .update(bookings)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledBy: "system",
      cancelReason: `Cancelled in Cal.com${reason ? `: ${reason}` : ""}`,
      updatedAt: new Date(),
    })
    .where(and(eq(bookings.id, b.id), eq(bookings.status, "confirmed")))
    .returning();
  if (!u) return "raced";
  await logEvent(db, b.id, "cancelled", "Booking cancelled", { public: true, actor: "system" });
  await logEvent(db, b.id, "note", "Cancelled in Cal.com — review refund in admin", {
    data: { calUid: p.uid, reason, refund: "none", amountPaidCents: b.amountPaidCents, giftCardCents: b.giftCardCents },
  });
  await notify.sendHostBookingAlert(b.id, "cancelled");
  await notifyWaitlist(b.experienceId, localDateKey(b.startAt));
  return "cancelled";
}

/* ------------------------------------------------------------------ */
/* BOOKING_RESCHEDULED                                                   */
/* ------------------------------------------------------------------ */

export async function applyCalReschedule(p: CalPayload): Promise<string> {
  const b = await findBookingForCal(p, { preferUids: true });
  if (!b) return "not ours";
  const start = parseDate(p.startTime);
  const end = parseDate(p.endTime) ?? (start && p.length ? new Date(start.getTime() + p.length * 60_000) : null);
  if (!start || !end || end <= start) return "missing times";
  if (b.status !== "confirmed") {
    const db = await getDb();
    await logEvent(db, b.id, "calendar_error", `Cal.com moved this ${b.status} booking to ${fmtDateShort(start)} ${fmtTimeRange(start, end)} — check the calendar`);
    return `ignored (${b.status})`;
  }

  const db = await getDb();
  const sameTime = start.getTime() === b.startAt.getTime() && end.getTime() === b.endAt.getTime();
  if (sameTime) {
    // Echo of our own rescheduleBooking (or a no-op move): just track the new uid.
    if (p.uid && p.uid !== b.calBookingUid) await db.update(bookings).set({ calBookingUid: p.uid }).where(eq(bookings.id, b.id));
    return "uid updated";
  }

  const previousStart = b.startAt;
  const conflicts = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"rp:" + b.resourceGroup}))`);
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60_000);
    await tx
      .update(bookings)
      .set({
        startAt: start,
        endAt: end,
        durationMinutes,
        calBookingUid: p.uid ?? b.calBookingUid,
        reminderSentAt: null,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, b.id));
    await logEvent(
      tx,
      b.id,
      "rescheduled",
      `Moved from ${fmtDateShort(previousStart)} ${fmtTimeRange(previousStart, b.endAt)} to ${fmtDateShort(start)} ${fmtTimeRange(start, end)}`,
      { public: true, actor: "system", data: { from: previousStart.toISOString(), to: start.toISOString(), via: "calcom" } },
    );
    return conflictsFor(tx, { id: b.id, resourceGroup: b.resourceGroup, experienceId: b.experienceId, startAt: start, endAt: end });
  });
  if (conflicts.length) {
    await logEvent(db, b.id, "calendar_error", `Moved in Cal.com onto a time that overlaps ${conflicts.join(", ")} — please check`);
  }
  await notify.sendHostBookingAlert(b.id, "rescheduled");
  await notifyWaitlist(b.experienceId, localDateKey(previousStart));
  return conflicts.length ? "rescheduled (with conflicts)" : "rescheduled";
}

/* ------------------------------------------------------------------ */
/* BOOKING_CREATED                                                       */
/* ------------------------------------------------------------------ */

function responseValue(responses: Record<string, unknown> | undefined, key: string): unknown {
  const v = responses?.[key];
  if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) return (v as { value: unknown }).value;
  return v;
}

/**
 * A booking made directly on Cal.com (not through this site): import it as a
 * confirmed booking so it shows in admin, reminders and reports. Bookings we
 * created ourselves carry metadata.rpBookingId and are only linked.
 */
export async function importCalBooking(p: CalPayload): Promise<string> {
  const db = await getDb();
  const rpId = str(p.metadata?.rpBookingId);
  if (rpId) {
    const [ours] = await db.select().from(bookings).where(eq(bookings.id, rpId)).limit(1);
    if (ours && !ours.calBookingUid && p.uid && ours.status === "confirmed") {
      await db.update(bookings).set({ calBookingUid: p.uid }).where(eq(bookings.id, ours.id));
      return "linked";
    }
    return "ours";
  }
  if (!p.uid) return "missing uid";
  const [dupe] = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.calBookingUid, p.uid)).limit(1);
  if (dupe) return "already imported";
  if (!p.eventTypeId) return "no event type";

  const [experience] = await db.select().from(experiences).where(eq(experiences.calEventTypeId, p.eventTypeId)).limit(1);
  if (!experience) return "unknown event type";

  const start = parseDate(p.startTime);
  const end = parseDate(p.endTime) ?? (start && p.length ? new Date(start.getTime() + p.length * 60_000) : null);
  if (!start || !end || end <= start) return "missing times";

  const attendee = p.attendees?.[0] ?? {};
  const email = (str(attendee.email) ?? str(responseValue(p.responses, "email")) ?? `cal+${p.uid}@rawplanet.invalid`).toLowerCase();
  const name = str(attendee.name) ?? str(responseValue(p.responses, "name")) ?? "Cal.com guest";
  const phone = str(attendee.phoneNumber) ?? str(responseValue(p.responses, "attendeePhoneNumber")) ?? null;
  const locale = typeof attendee.language === "string" ? attendee.language : attendee.language?.locale;
  const language = locale?.startsWith("es") ? "es" : "en";
  const extraGuests = responseValue(p.responses, "guests");
  const metaGuests = Number(p.metadata?.guests);
  const guests = Number.isInteger(metaGuests) && metaGuests > 0
    ? metaGuests
    : Math.max(1, (p.attendees?.length ?? 1) + (Array.isArray(extraGuests) ? extraGuests.length : 0));
  const notes = str(p.additionalNotes) ?? str(responseValue(p.responses, "notes")) ?? "";

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"rp:" + experience.resourceGroup}))`);
    const [again] = await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.calBookingUid, p.uid!)).limit(1);
    if (again) return null;

    let [customer] = await tx.select().from(customers).where(eq(customers.email, email)).limit(1);
    if (!customer) {
      [customer] = await tx.insert(customers).values({ email, name, phone, language }).returning();
    }
    const [b] = await tx
      .insert(bookings)
      .values({
        code: newBookingCode(),
        experienceId: experience.id,
        customerId: customer.id,
        status: "confirmed",
        paymentStatus: "not_required",
        source: "cal",
        startAt: start,
        endAt: end,
        durationMinutes: Math.round((end.getTime() - start.getTime()) / 60_000),
        guests,
        resourceGroup: experience.resourceGroup,
        contactName: name,
        contactEmail: email,
        contactPhone: phone,
        language,
        customerNotes: notes.slice(0, 2000),
        calBookingUid: p.uid!,
        externalRef: p.bookingId ? `cal:${p.bookingId}` : null,
        manageToken: newToken(),
        confirmedAt: new Date(),
      })
      .returning();
    await logEvent(tx, b.id, "created", "Imported from Cal.com (booked directly on the Cal.com page)", { data: { calUid: p.uid } });
    await logEvent(tx, b.id, "confirmed", "Booking confirmed", { public: true });
    const conflicts = await conflictsFor(tx, { id: b.id, resourceGroup: b.resourceGroup, experienceId: b.experienceId, startAt: start, endAt: end });
    if (conflicts.length) await logEvent(tx, b.id, "calendar_error", `Overlaps ${conflicts.join(", ")} — please check`);
    return b;
  });
  if (!result) return "already imported";
  await notify.sendHostBookingAlert(result.id, "new");
  return "imported";
}

export async function processCalEvent(body: CalWebhookBody): Promise<string> {
  const p = body.payload ?? {};
  switch (body.triggerEvent) {
    case "BOOKING_CANCELLED":
      return applyCalCancellation(p);
    case "BOOKING_RESCHEDULED":
      return applyCalReschedule(p);
    case "BOOKING_CREATED":
      return importCalBooking(p);
    case "PING":
      return "pong";
    default:
      return `unhandled ${body.triggerEvent}`;
  }
}
