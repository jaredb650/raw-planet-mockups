/**
 * Small helpers shared by the public booking APIs and server actions:
 * client IP, an in-memory per-key token bucket, JSON error responses and
 * mapping domain errors to HTTP status codes.
 *
 * The rate limiter is per process. It is a speed bump against scripted abuse
 * of checkout/quote/waitlist, not a security boundary; put a shared limiter
 * (Upstash, Vercel firewall) in front if the site runs on many instances.
 */
import "server-only";
import { z } from "zod";
import { BookingError } from "@/lib/booking/service";
import { PricingError } from "@/lib/booking/pricing";

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? "local";
}

type Bucket = { tokens: number; at: number };
const g = globalThis as unknown as { __rpBuckets?: Map<string, Bucket> };
const buckets = (g.__rpBuckets ??= new Map<string, Bucket>());

/**
 * Token bucket: `capacity` requests in a burst, refilled at `perMinute`.
 * Returns true when the request may proceed.
 */
export function rateLimit(key: string, opts: { capacity: number; perMinute: number }): boolean {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: opts.capacity, at: now };
  const refill = ((now - b.at) / 60_000) * opts.perMinute;
  b.tokens = Math.min(opts.capacity, b.tokens + refill);
  b.at = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 10_000) {
    // Drop the oldest entries so the map can't grow without bound.
    for (const k of [...buckets.keys()].slice(0, 2_000)) buckets.delete(k);
  }
  return true;
}

export const LIMITS = {
  checkout: { capacity: 12, perMinute: 6 },
  quote: { capacity: 60, perMinute: 60 },
  availability: { capacity: 120, perMinute: 120 },
  waitlist: { capacity: 6, perMinute: 3 },
  giftCard: { capacity: 8, perMinute: 4 },
  balance: { capacity: 10, perMinute: 5 },
  manageLinks: { capacity: 5, perMinute: 2 },
  status: { capacity: 120, perMinute: 60 },
} as const;

export function tooMany(): Response {
  return Response.json(
    { error: "You're going a little fast. Please wait a moment and try again.", code: "rate_limited" },
    { status: 429, headers: { "Retry-After": "30", "Cache-Control": "no-store" } },
  );
}

export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}): Response {
  return Response.json({ error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

/** zod issues → { fieldName: "message" } (first message per field). */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Map service errors to a status code + friendly message. Unknown errors → 500. */
export function domainErrorResponse(err: unknown): Response {
  if (err instanceof BookingError) {
    const status =
      err.code === "slot_unavailable" ? 409 : err.code === "not_found" ? 404 : err.code === "payment" || err.code === "calendar" ? 502 : 400;
    return jsonError(status, err.message, { code: err.code });
  }
  if (err instanceof PricingError) return jsonError(400, err.message, { code: "invalid" });
  console.error("[api] unexpected error", err);
  return jsonError(500, "Something went wrong on our side. Please try again in a moment.", { code: "server" });
}

/** Read a JSON body without throwing. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/** YYYY-MM-DD that is a real calendar date. */
export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Not a real date");
