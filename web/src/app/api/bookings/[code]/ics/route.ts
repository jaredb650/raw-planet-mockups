/**
 * GET /api/bookings/[code]/ics?t=token → text/calendar download for the guest.
 */
import type { NextRequest } from "next/server";
import { getBookingForCustomer } from "@/lib/booking/service";
import { bookingCalendarEvent } from "@/components/booking/server/calendar-event";
import { jsonError } from "../../../_lib/http";
import { buildIcs } from "@/lib/ics";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bookingEvents } from "@/lib/db/schema";

export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const booking = await getBookingForCustomer(code, req.nextUrl.searchParams.get("t") ?? "");
  if (!booking) return jsonError(404, "We couldn't find that booking.");
  if (booking.status === "pending_payment" || booking.status === "expired")
    return jsonError(409, "This booking isn't confirmed yet.");

  const event = await bookingCalendarEvent(booking);
  // Same SEQUENCE as the emailed invites (notify.ts): every move, by guest or host, plus 10 once cancelled.
  const db = await getDb();
  const [moves] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bookingEvents)
    .where(and(eq(bookingEvents.bookingId, booking.id), eq(bookingEvents.type, "rescheduled")));
  const sequence = Math.max(Number(moves?.n ?? 0), booking.rescheduleCount) + (booking.status === "cancelled" ? 10 : 0);
  const ics = buildIcs(
    [
      {
        uid: `${booking.id}@rawplanetexperiences.com`,
        start: booking.startAt,
        end: booking.endAt,
        summary: event.summary,
        description: event.description,
        location: event.location,
        url: event.url,
        status: booking.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
        sequence,
      },
    ],
    { name: "Raw Planet Experiences" },
  );
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="raw-planet-${booking.code}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
