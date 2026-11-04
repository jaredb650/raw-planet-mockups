/**
 * Cal.com API v2 adapter.
 *
 * Cal.com is connected to the host's Google Calendar ("check for conflicts" +
 * "add events to"). Airbnb Experiences syncs two-way with the same Google
 * Calendar, so Cal.com's slot list already excludes Airbnb bookings, and every
 * booking we create here lands on Google → Airbnb blocks it. That single
 * calendar is what prevents double-booking across platforms.
 *
 * Every function is a no-op / returns null when CALCOM_API_KEY is unset so the
 * site runs locally on the built-in availability engine.
 */
import "server-only";
import { integrations } from "@/lib/config";

const BASE = (process.env.CALCOM_API_URL ?? "https://api.cal.com/v2").replace(/\/$/, "");
const V_SLOTS = "2024-09-04";
const V_BOOKINGS = "2026-02-25";

export class CalcomError extends Error {
  constructor(message: string, public status?: number, public body?: unknown) {
    super(message);
  }
}

async function call<T>(path: string, version: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.CALCOM_API_KEY}`,
      "cal-api-version": version,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg =
      (body as { error?: { message?: string }; message?: string })?.error?.message ??
      (body as { message?: string })?.message ??
      `Cal.com ${res.status}`;
    throw new CalcomError(msg, res.status, body);
  }
  return body as T;
}

/* ---------------- Slots ---------------- */

type SlotsResponse = { status: string; data: Record<string, { start: string; end?: string }[]> };

const slotCache = new Map<string, { at: number; starts: Set<number> }>();
const FRESH_MS = 60_000;
const STALE_OK_MS = 15 * 60_000;

/**
 * Start instants (epoch ms) Cal.com considers bookable for the event type,
 * duration and UTC range. Returns null when Cal.com isn't configured.
 * Uses a 60s cache and falls back to a ≤15 min stale copy on errors.
 */
export async function calAvailableStarts(opts: {
  eventTypeId: number;
  start: Date;
  end: Date;
  durationMinutes: number;
}): Promise<Set<number> | null> {
  if (!integrations.calcom()) return null;
  const key = `${opts.eventTypeId}:${opts.durationMinutes}:${opts.start.toISOString()}:${opts.end.toISOString()}`;
  const hit = slotCache.get(key);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.starts;
  try {
    const qs = new URLSearchParams({
      eventTypeId: String(opts.eventTypeId),
      start: opts.start.toISOString(),
      end: opts.end.toISOString(),
      timeZone: "UTC",
      duration: String(opts.durationMinutes),
    });
    const res = await call<SlotsResponse>(`/slots?${qs}`, V_SLOTS);
    const starts = new Set<number>();
    for (const day of Object.values(res.data ?? {})) for (const s of day) starts.add(new Date(s.start).getTime());
    slotCache.set(key, { at: Date.now(), starts });
    return starts;
  } catch (err) {
    if (hit && Date.now() - hit.at < STALE_OK_MS) return hit.starts;
    console.error("[calcom] slots failed", err);
    throw err;
  }
}

export function invalidateCalSlots(): void {
  slotCache.clear();
}

/* ---------------- Reservations (hold while paying) ---------------- */

export async function calReserveSlot(opts: {
  eventTypeId: number;
  start: Date;
  durationMinutes: number;
  holdMinutes: number;
}): Promise<{ reservationUid: string; until: string } | null> {
  if (!integrations.calcom()) return null;
  const res = await call<{ data: { reservationUid: string; reservationUntil: string } }>(`/slots/reservations`, V_SLOTS, {
    method: "POST",
    body: JSON.stringify({
      eventTypeId: opts.eventTypeId,
      slotStart: opts.start.toISOString(),
      slotDuration: opts.durationMinutes,
      reservationDuration: opts.holdMinutes,
    }),
  });
  return { reservationUid: res.data.reservationUid, until: res.data.reservationUntil };
}

export async function calReleaseSlot(reservationUid: string | null | undefined): Promise<void> {
  if (!integrations.calcom() || !reservationUid) return;
  try {
    await call(`/slots/reservations/${encodeURIComponent(reservationUid)}`, V_SLOTS, { method: "DELETE" });
  } catch (err) {
    console.warn("[calcom] release reservation failed (will lapse on its own)", err);
  }
}

/* ---------------- Bookings ---------------- */

type CalBooking = { id: number; uid: string; status: string; start: string; end: string };

export async function calCreateBooking(opts: {
  eventTypeId: number;
  start: Date;
  durationMinutes: number;
  attendee: { name: string; email: string; phone?: string | null; language?: string };
  metadata: Record<string, string>;
  notes?: string;
}): Promise<CalBooking | null> {
  if (!integrations.calcom()) return null;
  const res = await call<{ data: CalBooking }>(`/bookings`, V_BOOKINGS, {
    method: "POST",
    body: JSON.stringify({
      start: opts.start.toISOString(),
      eventTypeId: opts.eventTypeId,
      lengthInMinutes: opts.durationMinutes,
      attendee: {
        name: opts.attendee.name,
        email: opts.attendee.email,
        timeZone: "America/New_York",
        language: opts.attendee.language === "es" ? "es" : "en",
        ...(opts.attendee.phone ? { phoneNumber: opts.attendee.phone } : {}),
      },
      metadata: opts.metadata,
      ...(opts.notes ? { bookingFieldsResponses: { notes: opts.notes.slice(0, 1000) } } : {}),
    }),
  });
  invalidateCalSlots();
  return res.data;
}

export async function calCancelBooking(uid: string | null | undefined, reason: string): Promise<void> {
  if (!integrations.calcom() || !uid) return;
  await call(`/bookings/${encodeURIComponent(uid)}/cancel`, V_BOOKINGS, {
    method: "POST",
    body: JSON.stringify({ cancellationReason: reason.slice(0, 500) }),
  });
  invalidateCalSlots();
}

export async function calRescheduleBooking(
  uid: string,
  start: Date,
  durationMinutes: number,
  reason: string,
): Promise<CalBooking | null> {
  if (!integrations.calcom()) return null;
  const res = await call<{ data: CalBooking }>(`/bookings/${encodeURIComponent(uid)}/reschedule`, V_BOOKINGS, {
    method: "POST",
    body: JSON.stringify({ start: start.toISOString(), lengthInMinutes: durationMinutes, reschedulingReason: reason }),
  });
  invalidateCalSlots();
  return res.data;
}

/* ---------------- Webhooks ---------------- */

/** Verify `x-cal-signature-256` (HMAC-SHA256 of the raw body, hex). */
export async function verifyCalSignature(rawBody: string, signature: string | null): Promise<boolean> {
  const secret = process.env.CALCOM_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const got = signature.replace(/^sha256=/, "");
  if (got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}
