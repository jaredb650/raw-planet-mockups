/**
 * Extra read models for the public site that aren't in src/lib/queries/public.ts.
 * (Candidates to move into the shared module later.)
 */
import "server-only";
import { and, avg, count, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { experiences, reviews } from "@/lib/db/schema";

/** Average + count of published reviews for one experience (direct + imported). */
export async function getExperienceRating(experienceId: string): Promise<{ score: number; count: number } | null> {
  const db = await getDb();
  const [row] = await db
    .select({ n: count(), avg: avg(reviews.rating) })
    .from(reviews)
    .where(and(eq(reviews.status, "published"), eq(reviews.experienceId, experienceId)));
  const n = Number(row?.n ?? 0);
  if (!n) return null;
  return { score: Math.round(Number(row.avg) * 100) / 100, count: n };
}

export async function getReviewForBooking(bookingId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ id: reviews.id, rating: reviews.rating, status: reviews.status })
    .from(reviews)
    .where(eq(reviews.bookingId, bookingId))
    .limit(1);
  return row ?? null;
}

export async function getExperienceSummary(id: string) {
  const db = await getDb();
  const [row] = await db
    .select({ id: experiences.id, slug: experiences.slug, name: experiences.name, shortName: experiences.shortName, theme: experiences.theme })
    .from(experiences)
    .where(eq(experiences.id, id))
    .limit(1);
  return row ?? null;
}

/** Whether a booking can leave a review yet: the session must have happened. */
export function reviewEligibility(b: { status: string; endAt: Date }, now = new Date()): { ok: true } | { ok: false; reason: "not_yet" | "cancelled" } {
  if (b.status === "completed") return { ok: true };
  if (b.status === "confirmed" || b.status === "no_show") return b.endAt <= now ? { ok: true } : { ok: false, reason: "not_yet" };
  return { ok: false, reason: "cancelled" };
}
