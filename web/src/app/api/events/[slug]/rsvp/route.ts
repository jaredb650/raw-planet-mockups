import { and, eq, sql } from "drizzle-orm";
import { TURNSTILE_FAILED, verifyTurnstile } from "@/lib/turnstile";
import { clientIp } from "@/app/api/_lib/http";
import { requestLang } from "@/lib/lang";
import { z } from "zod";
import { fail, json, limited, readBody, sameOrigin } from "@/components/site/server/api";
import { getDb } from "@/lib/db";
import { eventRsvps, events } from "@/lib/db/schema";
import { sendEventRsvp } from "@/lib/email/notify";

const MAX_PARTY = 4;

const Body = z.object({
  name: z.string({ error: "Please add your name." }).trim().min(1, { error: "Please add your name." }).max(120),
  email: z.email({ error: "Please check your email address." }).trim().toLowerCase().max(200),
  guests: z.coerce.number().int().min(1).max(MAX_PARTY).default(1),
  website: z.string().max(200).optional(), // honeypot
  turnstileToken: z.string().max(4096).optional().nullable(),
});

/**
 * Free on-site RSVP. Capacity is enforced inside a transaction that holds a
 * per-event advisory lock, so two people can't take the last spot together.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/events/[slug]/rsvp">) {
  if (!sameOrigin(req)) return fail("Invalid request.", 403);
  if (limited(req, "rsvp", { capacity: 8, perMinute: 4 })) return fail("Too many tries. Please wait a minute and try again.", 429);
  const { slug } = await ctx.params;
  const body = await readBody(req, Body);
  if (!body.ok) return body.res;
  const { name, email, guests, website, turnstileToken } = body.data;

  const db = await getDb();
  const [ev] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
  if (!ev || ev.status === "draft") return fail("We couldn't find that event.", 404);
  // Honeypot: pretend it worked so bots learn nothing.
  if (website) return json({ ok: true, already: false });
  if (!(await verifyTurnstile(turnstileToken, clientIp(req.headers)))) return fail(TURNSTILE_FAILED);
  if (ev.status === "cancelled") return fail("This event has been cancelled.", 409);
  if (ev.endAt < new Date()) return fail("This event has already happened.", 409);
  if (!ev.rsvpEnabled) return fail("RSVPs for this event are on Meetup.", 409);
  if (ev.priceCents > 0) return fail("This is a paid event. Please use the ticket link.", 409);

  type Result = { kind: "created"; id: string } | { kind: "already" } | { kind: "full"; left: number };
  const result: Result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`rp:event:${ev.id}`}))`);
    const [existing] = await tx
      .select({ id: eventRsvps.id, status: eventRsvps.status, guests: eventRsvps.guests })
      .from(eventRsvps)
      .where(and(eq(eventRsvps.eventId, ev.id), eq(eventRsvps.email, email)))
      .limit(1);
    if (existing?.status === "going") return { kind: "already" } as const;

    if (ev.capacity != null) {
      const going = await tx
        .select({ guests: eventRsvps.guests })
        .from(eventRsvps)
        .where(and(eq(eventRsvps.eventId, ev.id), eq(eventRsvps.status, "going")));
      const left = ev.capacity - going.reduce((s, r) => s + r.guests, 0);
      if (guests > left) return { kind: "full", left: Math.max(0, left) } as const;
    }

    if (existing) {
      // A cancelled RSVP coming back: reuse the row (unique on event + email).
      await tx.update(eventRsvps).set({ status: "going", name, guests }).where(eq(eventRsvps.id, existing.id));
      return { kind: "created", id: existing.id } as const;
    }
    const [row] = await tx.insert(eventRsvps).values({ eventId: ev.id, name, email, guests, status: "going", language: requestLang(req) }).returning({ id: eventRsvps.id });
    return { kind: "created", id: row.id } as const;
  });

  if (result.kind === "already") return json({ ok: true, already: true });
  if (result.kind === "full") {
    return result.left > 0
      ? fail(`Only ${result.left} spot${result.left === 1 ? "" : "s"} left. Try a smaller number.`, 409, "guests")
      : fail("Sorry, that event just filled up.", 409);
  }

  try {
    await sendEventRsvp(result.id);
  } catch (err) {
    console.error("[rsvp] confirmation email failed", err);
  }
  return json({ ok: true, already: false }, 201);
}
