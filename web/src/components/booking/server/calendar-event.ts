/**
 * Calendar event details for a guest's booking (used by the .ics download and
 * the "Add to Google Calendar" links). The full address is only included for
 * confirmed bookings.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { experiences, type Booking, type Experience } from "@/lib/db/schema";
import { siteUrl } from "@/lib/config";
import { googleCalendarUrl } from "@/lib/ics";

export type BookingCalendarEvent = { summary: string; description: string; location: string; url: string; googleUrl: string };

export async function bookingCalendarEvent(booking: Booking, experience?: Experience): Promise<BookingCalendarEvent> {
  let exp = experience;
  if (!exp) {
    const db = await getDb();
    [exp] = await db.select().from(experiences).where(eq(experiences.id, booking.experienceId)).limit(1);
  }
  const confirmed = booking.status === "confirmed" || booking.status === "completed";
  const url = siteUrl(`/manage/${booking.code}?t=${booking.manageToken}`);
  const summary = `${exp?.name ?? "Session"} · Raw Planet`;
  const location = confirmed ? exp?.address || exp?.locationArea || "New York, NY" : exp?.locationArea ?? "New York, NY";
  const description = [
    `Booking ${booking.code} · ${booking.guests} guest${booking.guests === 1 ? "" : "s"}`,
    confirmed && exp?.arrivalInstructions ? exp.arrivalInstructions : null,
    `Manage your booking: ${url}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    summary,
    description,
    location,
    url,
    googleUrl: googleCalendarUrl({ start: booking.startAt, end: booking.endAt, summary, description, location }),
  };
}
