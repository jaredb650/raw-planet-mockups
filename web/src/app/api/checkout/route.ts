/**
 * POST /api/checkout → { url, code }
 *
 * Validates the guest's details, then hands off to createBooking, which
 * re-quotes on the server, takes the slot under an advisory lock, reserves
 * it in Cal.com and returns the Stripe Checkout (or test checkout) URL.
 * A $0 total (gift card / 100% code) confirms immediately and returns the
 * confirmation page URL.
 */
import { TURNSTILE_FAILED, verifyTurnstile } from "@/lib/turnstile";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getExperienceBySlugOrId } from "@/lib/booking/availability";
import { createBooking } from "@/lib/booking/service";
import { LIMITS, clientIp, domainErrorResponse, fieldErrors, jsonError, rateLimit, readJson, tooMany } from "../_lib/http";

const OCCASIONS = ["birthday", "date", "team", "just_because", "other"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .optional()
    .nullable()
    .transform((v) => v || null);

const checkoutSchema = z
  .object({
    experience: z.string().min(1).max(80),
    start: z.iso.datetime({ offset: true, message: "Pick a time." }),
    duration: z.coerce.number().int().min(15).max(24 * 60),
    guests: z.coerce.number().int().min(1).max(500),
    expectedTotalCents: z.number().int().min(0).optional().nullable(),
    addonIds: z.array(z.string().max(64)).max(20).optional().default([]),
    promoCode: optionalText(40),
    giftCardCode: optionalText(40),
    name: z.string().trim().min(2, "Tell us your name.").max(120, "That name is too long."),
    email: z.email("Enter a valid email address.").max(200),
    phone: z
      .string()
      .trim()
      .max(40)
      .optional()
      .nullable()
      .refine((v) => !v || /^[+()\-.\s\d]{7,}$/.test(v), "Enter a valid phone number, or leave it blank.")
      .transform((v) => v || null),
    language: z.enum(["en", "es"]).default("en"),
    occasion: z.enum(OCCASIONS).optional().nullable(),
    notes: optionalText(2000),
    marketingOptIn: z.boolean().optional().default(false),
    acceptPolicies: z.literal(true, { message: "Please agree to the booking policies." }),
    isGift: z.boolean().optional().default(false),
    giftRecipientName: optionalText(120),
    giftRecipientEmail: z
      .string()
      .trim()
      .max(200)
      .optional()
      .nullable()
      .refine((v) => !v || z.email().safeParse(v).success, "Enter a valid email address, or leave it blank.")
      .transform((v) => v || null),
    giftMessage: optionalText(1000),
    /** Honeypot: real people never see or fill this. */
    website: z.string().optional().nullable(),
    turnstileToken: z.string().max(4096).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.isGift && !v.giftRecipientName)
      ctx.addIssue({ code: "custom", path: ["giftRecipientName"], message: "Who's the gift for?" });
  });

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  if (!rateLimit(`checkout:${ip}`, LIMITS.checkout)) return tooMany();
  const parsed = checkoutSchema.safeParse(await readJson(req));
  if (!parsed.success)
    return jsonError(400, "Please check the highlighted fields.", { code: "invalid", fields: fieldErrors(parsed.error) });
  const b = parsed.data;
  if (b.website) {
    // Bot filled the hidden field. Don't reveal why.
    return jsonError(400, "Something went wrong. Please refresh the page and try again.", { code: "invalid" });
  }
  if (!(await verifyTurnstile(b.turnstileToken, ip))) return jsonError(400, TURNSTILE_FAILED, { code: "captcha" });

  try {
    const db = await getDb();
    const experience = await getExperienceBySlugOrId(db, b.experience);
    if (!experience || !experience.active) return jsonError(404, "That experience isn't available.", { code: "not_found" });

    const result = await createBooking({
      experienceId: experience.id,
      start: b.start,
      durationMinutes: b.duration,
      guests: b.guests,
      addonIds: b.addonIds,
      promoCode: b.promoCode,
      giftCardCode: b.giftCardCode,
      expectedTotalCents: b.expectedTotalCents ?? undefined,
      contact: { name: b.name, email: b.email, phone: b.phone },
      language: b.language,
      notes: b.notes ?? undefined,
      occasion: b.occasion ?? null,
      marketingOptIn: b.marketingOptIn,
      gift: b.isGift && b.giftRecipientName
        ? { recipientName: b.giftRecipientName, recipientEmail: b.giftRecipientEmail, message: b.giftMessage }
        : null,
    });
    return Response.json({ url: result.next.url, code: result.booking.code }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
