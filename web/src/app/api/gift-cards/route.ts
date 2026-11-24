/**
 * POST /api/gift-cards → { url }
 * { amountCents, purchaserName, purchaserEmail, recipientName?, recipientEmail?, message?, deliverOn?, website? }
 * Creates a pending gift card and returns the Stripe (or test) checkout URL.
 */
import { TURNSTILE_FAILED, verifyTurnstile } from "@/lib/turnstile";
import { requestLang } from "@/lib/lang";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { GIFT_CARD_MAX_CENTS, GIFT_CARD_MIN_CENTS, GiftCardError, createGiftCardPurchase } from "@/lib/giftcards";
import { formatMoney } from "@/lib/money";
import { LIMITS, clientIp, dateKeySchema, fieldErrors, jsonError, rateLimit, readJson, tooMany } from "../_lib/http";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .optional()
    .nullable()
    .transform((v) => v || null);

const schema = z.object({
  amountCents: z.coerce
    .number()
    .int("Choose a whole-dollar amount.")
    .min(GIFT_CARD_MIN_CENTS, `The smallest gift card is ${formatMoney(GIFT_CARD_MIN_CENTS)}.`)
    .max(GIFT_CARD_MAX_CENTS, `The largest gift card is ${formatMoney(GIFT_CARD_MAX_CENTS)}.`),
  purchaserName: z.string().trim().min(2, "Tell us your name.").max(120),
  purchaserEmail: z.email("Enter a valid email address.").max(200),
  recipientName: optionalText(120),
  recipientEmail: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .refine((v) => !v || z.email().safeParse(v).success, "Enter a valid email address, or leave it blank.")
    .transform((v) => v || null),
  message: optionalText(1000),
  deliverOn: dateKeySchema.optional().nullable().or(z.literal("").transform(() => null)),
  website: z.string().optional().nullable(),
  turnstileToken: z.string().max(4096).optional().nullable(),
});

export async function POST(req: NextRequest) {
  if (!rateLimit(`giftcard:${clientIp(req.headers)}`, LIMITS.giftCard)) return tooMany();
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", { fields: fieldErrors(parsed.error) });
  const g = parsed.data;
  if (g.website) return jsonError(400, "Something went wrong. Please refresh the page and try again.");
  if (!(await verifyTurnstile(g.turnstileToken, clientIp(req.headers)))) return jsonError(400, TURNSTILE_FAILED);
  try {
    const { url } = await createGiftCardPurchase({
      amountCents: g.amountCents,
      purchaserName: g.purchaserName,
      purchaserEmail: g.purchaserEmail,
      recipientName: g.recipientName,
      recipientEmail: g.recipientEmail,
      message: g.message,
      deliverOn: g.deliverOn ?? null,
      language: requestLang(req),
    });
    return Response.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof GiftCardError) {
      const field = /recipient/i.test(err.message) ? "recipientEmail" : /date/i.test(err.message) ? "deliverOn" : /amount/i.test(err.message) ? "amountCents" : null;
      return jsonError(400, err.message, field ? { fields: { [field]: err.message } } : {});
    }
    console.error("[gift-cards] purchase failed", err);
    return jsonError(500, "Something went wrong on our side. Please try again in a moment.");
  }
}
