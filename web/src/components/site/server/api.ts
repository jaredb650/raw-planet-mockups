/**
 * Helpers for the public site's form APIs (inquiries, event RSVPs, reviews):
 * JSON body parsing with a size cap, field-level zod errors and a small
 * per-IP rate limit (reuses the booking APIs' token bucket).
 */
import "server-only";
import type { z } from "zod";
import { clientIp, rateLimit } from "@/app/api/_lib/http";

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function fail(error: string, status = 400, field?: string): Response {
  return json({ ok: false, error, ...(field ? { field } : {}) }, status);
}

/** Same-origin check: browsers always send Origin on cross-site POSTs. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

export function limited(req: Request, bucket: string, opts = { capacity: 6, perMinute: 3 }): boolean {
  return !rateLimit(`site:${bucket}:${clientIp(req.headers)}`, opts);
}

export async function readBody<T extends z.ZodType>(req: Request, schema: T, maxBytes = 16_000): Promise<{ ok: true; data: z.infer<T> } | { ok: false; res: Response }> {
  const text = await req.text().catch(() => "");
  if (text.length > maxBytes) return { ok: false, res: fail("That's a bit long. Please shorten your message.", 413) };
  let raw: unknown;
  try {
    raw = JSON.parse(text || "{}");
  } catch {
    return { ok: false, res: fail("Invalid request.") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, res: fail(issue?.message ?? "Please check the form.", 422, issue?.path[0]?.toString()) };
  }
  return { ok: true, data: parsed.data };
}
