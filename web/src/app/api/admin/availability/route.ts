import { z } from "zod";
import { adminGuard } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getAvailability, getExperienceBySlugOrId } from "@/lib/booking/availability";

export const dynamic = "force-dynamic";

const q = z.object({
  experienceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.coerce.number().int().min(15).max(24 * 60),
  ignore: z.string().optional(),
});

/** One day's slots for the admin reschedule / new-booking pickers. "notice" slots are bookable by the host. */
export async function GET(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = q.safeParse(sp);
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const { experienceId, date, duration, ignore } = parsed.data;
  const db = await getDb();
  const experience = await getExperienceBySlugOrId(db, experienceId);
  if (!experience) return Response.json({ error: "Experience not found" }, { status: 404 });
  // The host isn't bound by the public booking window.
  const res = await getAvailability({
    experience: { ...experience, maxAdvanceDays: 3650 },
    fromKey: date,
    toKey: date,
    durationMinutes: duration,
    ignoreBookingId: ignore || undefined,
  });
  const day = res.days[0];
  return Response.json(
    {
      date,
      open: day?.open ?? false,
      calendarError: Boolean(res.calendarError),
      slots: (day?.slots ?? []).map((s) => ({
        start: s.start,
        end: s.end,
        available: s.available || s.reason === "notice",
        reason: s.reason ?? null,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
