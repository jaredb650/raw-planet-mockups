import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getBooking } from "@/lib/booking/service";
import { siteUrl } from "@/lib/config";
import { getDb } from "@/lib/db";
import { waivers, type Booking } from "@/lib/db/schema";
import { normalizeCode } from "@/lib/ids";
import { linkSecret } from "@/lib/review-token";

/**
 * Waiver links get their own signed token, never the manage token: they are
 * forwarded around the group, so they must only ever open the signing page.
 */
export function waiverToken(bookingId: string): string {
  return createHmac("sha256", linkSecret()).update(`waiver:${bookingId}`).digest("base64url").slice(0, 32);
}

export function verifyWaiverToken(bookingId: string, token: string): boolean {
  const expected = Buffer.from(waiverToken(bookingId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function waiverUrlFor(b: { id: string; code: string }): string {
  return siteUrl(`/waiver/${b.code}?t=${waiverToken(b.id)}`);
}

export async function getBookingForWaiver(code: string, token: string): Promise<Booking | undefined> {
  const b = await getBooking(normalizeCode(code));
  return b && token && verifyWaiverToken(b.id, token) ? b : undefined;
}

export async function countWaivers(bookingId: string): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(waivers).where(eq(waivers.bookingId, bookingId));
  return Number(row?.n ?? 0);
}
