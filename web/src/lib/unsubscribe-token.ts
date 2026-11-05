import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { siteUrl } from "@/lib/config";
import { linkSecret } from "@/lib/review-token";

/**
 * Unsubscribe links carry their own signed token, so a forwarded marketing email can only ever
 * stop marketing. Rotating AUTH_SECRET breaks links already sent, and CAN-SPAM needs them
 * working for 30 days after a send.
 */
export function unsubToken(customerId: string): string {
  return createHmac("sha256", linkSecret()).update(`unsub:${customerId}`).digest("base64url").slice(0, 32);
}

export function unsubTokenValid(customerId: string, token: string): boolean {
  if (!customerId || !token) return false;
  const expected = unsubToken(customerId);
  return expected.length === token.length && timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

/** One URL serves the human page (GET) and the RFC 8058 one-click POST. */
export function unsubUrl(customerId: string, lang: string): string {
  const q = new URLSearchParams({ c: customerId, t: unsubToken(customerId) });
  if (lang === "es") q.set("l", "es");
  return siteUrl(`/unsubscribe?${q}`);
}
