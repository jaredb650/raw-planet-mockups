/**
 * POST /api/quote  { experience, start, duration, guests, addonIds?, promoCode?, giftCardCode? }
 * → { quote, promoError, giftCardError }
 *
 * Display-only: /api/checkout re-quotes on the server, so nothing here is trusted later.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getExperienceBySlugOrId } from "@/lib/booking/availability";
import { buildQuote } from "@/lib/booking/service";
import { LIMITS, clientIp, domainErrorResponse, fieldErrors, jsonError, rateLimit, readJson, tooMany } from "../_lib/http";

const quoteSchema = z.object({
  experience: z.string().min(1).max(80),
  start: z.iso.datetime({ offset: true }),
  duration: z.coerce.number().int().min(15).max(24 * 60),
  guests: z.coerce.number().int().min(1).max(500),
  addonIds: z.array(z.string().max(64)).max(20).optional().default([]),
  promoCode: z.string().trim().max(40).optional().nullable(),
  giftCardCode: z.string().trim().max(40).optional().nullable(),
});

export async function POST(req: NextRequest) {
  if (!rateLimit(`quote:${clientIp(req.headers)}`, LIMITS.quote)) return tooMany();
  const parsed = quoteSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, "Please check your booking details.", { fields: fieldErrors(parsed.error) });
  const q = parsed.data;
  try {
    const db = await getDb();
    const experience = await getExperienceBySlugOrId(db, q.experience);
    if (!experience || !experience.active) return jsonError(404, "That experience isn't available.");
    const { quote, giftCardError } = await buildQuote(db, {
      experienceId: experience.id,
      start: q.start,
      durationMinutes: q.duration,
      guests: q.guests,
      addonIds: q.addonIds,
      promoCode: q.promoCode || null,
      giftCardCode: q.giftCardCode || null,
    });
    return Response.json(
      {
        quote: {
          subtotalCents: quote.subtotalCents,
          addonsCents: quote.addonsCents,
          discountCents: quote.discountCents,
          giftCardCents: quote.giftCardCents,
          totalCents: quote.totalCents,
          lines: quote.lines,
        },
        promoError: q.promoCode ? quote.promoError : null,
        giftCardError,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return domainErrorResponse(err);
  }
}
