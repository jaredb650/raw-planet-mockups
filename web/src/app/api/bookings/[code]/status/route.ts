/**
 * GET /api/bookings/[code]/status?t=token[&session_id=cs_...]
 * Lightweight status for the confirmation page's poll. If the Stripe webhook
 * hasn't landed yet, checks the Checkout Session directly.
 */
import type { NextRequest } from "next/server";
import { getBookingForCustomer } from "@/lib/booking/service";
import { reconcileBookingPayment } from "../../../_lib/stripe-sync";
import { LIMITS, clientIp, jsonError, rateLimit, tooMany } from "../../../_lib/http";

export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  if (!rateLimit(`status:${clientIp(req.headers)}`, LIMITS.status)) return tooMany();
  const { code } = await ctx.params;
  const token = req.nextUrl.searchParams.get("t") ?? "";
  let booking = await getBookingForCustomer(code, token);
  if (!booking) return jsonError(404, "We couldn't find that booking.");
  booking = await reconcileBookingPayment(booking, req.nextUrl.searchParams.get("session_id"));
  return Response.json(
    {
      code: booking.code,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
