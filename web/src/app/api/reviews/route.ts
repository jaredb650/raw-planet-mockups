import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { reviewEligibility } from "@/components/site/queries";
import { fail, json, limited, readBody, sameOrigin } from "@/components/site/server/api";
import { getBookingForReview } from "@/lib/review-token";
import { getDb } from "@/lib/db";
import { reviews } from "@/lib/db/schema";

const Body = z.object({
  code: z.string().trim().min(1).max(40),
  token: z.string().trim().min(1).max(200),
  rating: z.coerce.number({ error: "Please pick a star rating." }).int().min(1, { error: "Please pick a star rating." }).max(5),
  body: z.string({ error: "Please write a sentence or two." }).trim().min(10, { error: "A sentence or two, please (at least 10 characters)." }).max(3000),
  name: z.string({ error: "Please add the name to show with your review." }).trim().min(1, { error: "Please add the name to show with your review." }).max(80),
  location: z.string().trim().max(80).optional().transform((v) => v || null),
});

/**
 * Guest review from the post-session email link (/review/[code]?t=token).
 * Only the booking's own manage token works, once per booking, after the
 * session. Reviews land as "pending" until the host publishes them in admin.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("Invalid request.", 403);
  if (limited(req, "review", { capacity: 6, perMinute: 3 })) return fail("Too many tries. Please wait a minute and try again.", 429);
  const body = await readBody(req, Body);
  if (!body.ok) return body.res;
  const d = body.data;

  const booking = await getBookingForReview(d.code, d.token);
  if (!booking) return fail("This review link isn't valid. Please use the link from your email.", 403);
  const can = reviewEligibility(booking);
  if (!can.ok) {
    return fail(can.reason === "not_yet" ? "You can leave a review once your session has happened." : "This booking can't be reviewed.", 409);
  }
  const db = await getDb();
  // Lock per booking so a double-submit can't create two reviews (no unique index on reviews.booking_id yet).
  const created = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`rp:review:${booking.id}`}))`);
    const [dupe] = await tx.select({ id: reviews.id }).from(reviews).where(eq(reviews.bookingId, booking.id)).limit(1);
    if (dupe) return false;
    await tx.insert(reviews).values({
      bookingId: booking.id,
      experienceId: booking.experienceId,
      name: d.name,
      location: d.location,
      rating: d.rating,
      body: d.body,
      source: "direct",
      status: "pending",
      reviewDate: new Date(),
    });
    return true;
  });
  if (!created) return fail("You've already left a review for this booking. Thank you!", 409);
  return json({ ok: true }, 201);
}
