/**
 * GET|POST /api/cron/run[?job=reminders,followups] → runs the scheduled jobs.
 *
 * Auth (any one of):
 *  - `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this automatically;
 *    use the same header from cron-job.org / GitHub Actions)
 *  - a signed-in admin session (the admin "Run now" button)
 *  - local development with no CRON_SECRET set
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { JOBS, runJobs, type JobName } from "@/lib/automation/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function bearerOk(req: NextRequest, secret: string): boolean {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;
  const a = createHash("sha256").update(token).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

async function authorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && bearerOk(req, secret)) return true;
  if (await isAdmin()) return true;
  return !secret && process.env.NODE_ENV !== "production";
}

async function handle(req: NextRequest) {
  if (!(await authorized(req))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const param = req.nextUrl.searchParams.get("job");
  let only: JobName[] | undefined;
  if (param) {
    const names = param.split(",").map((s) => s.trim()).filter(Boolean);
    const unknown = names.filter((n) => !(JOBS as readonly string[]).includes(n));
    if (unknown.length) return Response.json({ error: `Unknown job: ${unknown.join(", ")}`, jobs: JOBS }, { status: 400 });
    only = names as JobName[];
  }
  const result = await runJobs({ only });
  return Response.json(result, { status: result.ok ? 200 : 207, headers: { "Cache-Control": "no-store" } });
}

export const GET = handle;
export const POST = handle;
