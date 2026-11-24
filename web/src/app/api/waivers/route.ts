import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { clientIp } from "@/app/api/_lib/http";
import { fail, json, limited, readBody, sameOrigin } from "@/components/site/server/api";
import { getDb } from "@/lib/db";
import { waivers } from "@/lib/db/schema";
import { alreadySigned, signingState, WAIVER_COPY, waiverSnapshot, waiverVersion } from "@/lib/waiver";
import { getBookingForWaiver } from "@/lib/waiver-token";

const Body = z
  .object({
    code: z.string().trim().min(1).max(40),
    token: z.string().trim().min(1).max(200),
    lang: z.enum(["en", "es"]),
    name: z.string().trim().min(2, { error: "Please type your full name." }).max(120),
    agree: z.literal(true, { error: "Please tick the box to agree before you sign." }),
    recording: z.boolean(),
    forMinor: z.boolean(),
    minorName: z.string().trim().max(120),
  })
  .refine((d) => !d.forMinor || d.minorName.length >= 2, { path: ["minorName"], error: "Please add the minor's full name." });

/** A guest signing on the shared link from /waiver/[code]?t=token. The wording stored is ours, never the client's. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("Invalid request.", 403);
  if (limited(req, "waiver", { capacity: 12, perMinute: 6 })) return fail(WAIVER_COPY.en.ui.errRate, 429);
  const body = await readBody(req, Body);
  if (!body.ok) return body.res;
  const d = body.data;
  const t = WAIVER_COPY[d.lang].ui;

  const booking = await getBookingForWaiver(d.code, d.token);
  if (!booking) return fail(t.badBody, 403);

  const signer = { signerName: d.name, minorName: d.forMinor ? d.minorName : null };
  const db = await getDb();
  // Lock per booking so two guests signing at once can't slip past the signer limit.
  const r = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`rp:waiver:${booking.id}`}))`);
    const existing = await tx.select({ signerName: waivers.signerName, minorName: waivers.minorName }).from(waivers).where(eq(waivers.bookingId, booking.id));
    const state = signingState(booking, existing.length);
    if (state === "closed") return { state, signed: existing.length };
    if (alreadySigned(existing, signer)) return { state: "open" as const, signed: existing.length };
    if (state === "full") return { state, signed: existing.length };
    await tx.insert(waivers).values({
      bookingId: booking.id,
      ...signer,
      recordingConsent: d.recording,
      waiverVersion: waiverVersion(d.lang),
      waiverText: waiverSnapshot(d.lang),
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    });
    return { state: "open" as const, signed: existing.length + 1 };
  });
  if (r.state === "closed") return fail(t.closedBody, 409);
  if (r.state === "full") return fail(t.fullBody, 409);
  return json({ ok: true, signed: r.signed }, 201);
}
