import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getBooking } from "@/lib/booking/service";
import type { Booking } from "@/lib/db/schema";
import { normalizeCode } from "@/lib/ids";

/**
 * Review links get their own signed token instead of the manage token, so a review email
 * forwarded to (or sent to) a gift recipient can never cancel or reschedule the booking.
 */
export function linkSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be set in production");
  return s ?? "dev-only-insecure-secret-change-me-please-32b";
}

export function reviewToken(bookingId: string): string {
  return createHmac("sha256", linkSecret()).update(`review:${bookingId}`).digest("base64url").slice(0, 32);
}

export async function getBookingForReview(code: string, token: string): Promise<Booking | undefined> {
  const b = await getBooking(normalizeCode(code));
  if (!b || !token) return undefined;
  const expected = reviewToken(b.id);
  return expected.length === token.length && timingSafeEqual(Buffer.from(expected), Buffer.from(token)) ? b : undefined;
}
