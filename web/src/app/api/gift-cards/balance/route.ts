/**
 * GET /api/gift-cards/balance?code=RAW-XXXX-XXXX-XXXX → { balanceCents, status }
 * Tightly rate limited: codes are long and random, but this is the one place
 * they could be guessed at.
 */
import type { NextRequest } from "next/server";
import { getGiftCardBalance } from "@/lib/giftcards";
import { LIMITS, clientIp, jsonError, rateLimit, tooMany } from "../../_lib/http";

export async function GET(req: NextRequest) {
  if (!rateLimit(`balance:${clientIp(req.headers)}`, LIMITS.balance)) return tooMany();
  const code = (req.nextUrl.searchParams.get("code") ?? "").trim();
  if (!code || code.length > 40) return jsonError(400, "Enter the code from your gift card.");
  const card = await getGiftCardBalance(code);
  if (!card || card.status === "pending_payment") return jsonError(404, "We couldn't find that gift card. Check the code and try again.");
  return Response.json(
    { balanceCents: card.balanceCents, status: card.status },
    { headers: { "Cache-Control": "no-store" } },
  );
}
