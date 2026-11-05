/**
 * GET /api/availability?experience=slug&from=YYYY-MM-DD&to=YYYY-MM-DD&duration=120
 *   [&booking=RP-XXXXXX&t=token]  (reschedule: ignore the guest's own booking)
 *
 * → { experience, duration, days: [{ date, open, available, slots }], calendarError? }
 * Slots carry priceCents (one guest, or one session before extra guests) and adjustPercent when
 * smart pricing applies. Party totals round once on the whole subtotal, so the picker computes them
 * with computeQuote and adjustPercent. Reschedules keep the price paid, so their slots carry no price.
 * Range is capped at 62 days. Never cached: holds and bookings change by the second.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getAvailability, getExperienceBySlugOrId } from "@/lib/booking/availability";
import { adjustedCents, durationPrice } from "@/lib/booking/pricing";
import { getBookingForCustomer } from "@/lib/booking/service";
import { addDaysKey } from "@/lib/time";
import { LIMITS, clientIp, dateKeySchema, fieldErrors, jsonError, rateLimit, tooMany } from "../_lib/http";

const MAX_DAYS = 62;

const querySchema = z.object({
  experience: z.string().min(1).max(80),
  from: dateKeySchema,
  to: dateKeySchema,
  duration: z.coerce.number().int().min(15).max(24 * 60),
  booking: z.string().max(20).optional(),
  t: z.string().max(64).optional(),
});

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  if (!rateLimit(`avail:${clientIp(req.headers)}`, LIMITS.availability)) return tooMany();
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return jsonError(400, "Invalid availability request.", { fields: fieldErrors(parsed.error) });
  const q = parsed.data;
  if (q.to < q.from) return jsonError(400, "`to` must be on or after `from`.");

  const db = await getDb();
  const experience = await getExperienceBySlugOrId(db, q.experience);
  if (!experience || !experience.active) return jsonError(404, "That experience isn't available.");
  if (!experience.durationOptions.some((o) => o.minutes === q.duration))
    return jsonError(400, "That session length isn't offered for this experience.");

  const toKey = q.to > addDaysKey(q.from, MAX_DAYS - 1) ? addDaysKey(q.from, MAX_DAYS - 1) : q.to;

  let ignoreBookingId: string | undefined;
  if (q.booking && q.t) {
    const own = await getBookingForCustomer(q.booking, q.t);
    if (own && own.experienceId === experience.id) ignoreBookingId = own.id;
  }

  const { days, calendarError } = await getAvailability({
    experience,
    fromKey: q.from,
    toKey,
    durationMinutes: q.duration,
    ignoreBookingId,
  });
  const unitCents = durationPrice(experience, q.duration);

  return Response.json(
    {
      experience: experience.slug,
      duration: q.duration,
      from: q.from,
      to: toKey,
      days: days.map((d) => ({
        date: d.date,
        open: d.open,
        available: d.slots.filter((s) => s.available).length,
        slots: d.slots.map(({ adjustPercent, ...s }) => (ignoreBookingId ? s : { ...s, adjustPercent, priceCents: adjustedCents(unitCents, adjustPercent ?? 0) })),
      })),
      ...(calendarError ? { calendarError: true } : {}),
    },
    { headers: NO_STORE },
  );
}
