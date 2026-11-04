/**
 * POST /api/waitlist  { experience, date, name, email, guests, website? }
 * Joins the waitlist for a fully booked day. The booking service emails
 * everyone on the list when a slot on that day frees up.
 */
import { TURNSTILE_FAILED, verifyTurnstile } from "@/lib/turnstile";
import { requestLang } from "@/lib/lang";
import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { waitlist } from "@/lib/db/schema";
import { getExperienceBySlugOrId } from "@/lib/booking/availability";
import { addDaysKey, todayKey } from "@/lib/time";
import { LIMITS, clientIp, dateKeySchema, fieldErrors, jsonError, rateLimit, readJson, tooMany } from "../_lib/http";

const schema = z.object({
  experience: z.string().min(1).max(80),
  date: dateKeySchema,
  name: z.string().trim().min(2, "Tell us your name.").max(120),
  email: z.email("Enter a valid email address.").max(200),
  guests: z.coerce.number().int().min(1).max(500).default(1),
  website: z.string().optional().nullable(),
  turnstileToken: z.string().max(4096).optional().nullable(),
});

export async function POST(req: NextRequest) {
  if (!rateLimit(`waitlist:${clientIp(req.headers)}`, LIMITS.waitlist)) return tooMany();
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", { fields: fieldErrors(parsed.error) });
  const w = parsed.data;
  if (w.website) return Response.json({ ok: true });
  if (!(await verifyTurnstile(w.turnstileToken, clientIp(req.headers)))) return jsonError(400, TURNSTILE_FAILED);

  const db = await getDb();
  const experience = await getExperienceBySlugOrId(db, w.experience);
  if (!experience || !experience.active) return jsonError(404, "That experience isn't available.");
  const today = todayKey();
  if (w.date < today || w.date > addDaysKey(today, experience.maxAdvanceDays))
    return jsonError(400, "We can only add you to the waitlist for upcoming dates.", { fields: { date: "Pick an upcoming date." } });
  if (w.guests < experience.minGuests || w.guests > experience.maxGuests)
    return jsonError(400, `Choose between ${experience.minGuests} and ${experience.maxGuests} guests.`, {
      fields: { guests: "Out of range." },
    });

  const email = w.email.trim().toLowerCase();
  const [existing] = await db
    .select({ id: waitlist.id })
    .from(waitlist)
    .where(and(eq(waitlist.experienceId, experience.id), eq(waitlist.date, w.date), eq(waitlist.email, email)))
    .limit(1);
  if (existing) {
    await db.update(waitlist).set({ guests: w.guests, name: w.name, notifiedAt: null }).where(eq(waitlist.id, existing.id));
  } else {
    await db.insert(waitlist).values({ experienceId: experience.id, date: w.date, name: w.name, email, guests: w.guests, language: requestLang(req) });
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
