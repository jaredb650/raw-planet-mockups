/**
 * GET /api/calendar/<token>.ics → the host's private booking feed
 * (subscribe from Google / Apple Calendar). Unknown tokens get a plain 404.
 */
import type { NextRequest } from "next/server";
import { buildCalendarFeed, verifyCalendarFeedToken } from "@/lib/calendar-feed";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const token = file.replace(/\.ics$/i, "");
  if (!/^[A-Za-z0-9]{16,64}$/.test(token) || !(await verifyCalendarFeedToken(token))) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const ics = await buildCalendarFeed();
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="raw-planet-bookings.ics"',
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
