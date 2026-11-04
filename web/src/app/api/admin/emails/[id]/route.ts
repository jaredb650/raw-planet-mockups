import { eq } from "drizzle-orm";
import { adminGuard } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { emailLog } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** The stored HTML of a sent email, for the admin preview iframe. Sandboxed: no scripts, no forms. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id } = await ctx.params;
  const db = await getDb();
  const [m] = await db.select({ html: emailLog.html }).from(emailLog).where(eq(emailLog.id, id)).limit(1);
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(m.html ?? "<p style='font-family:sans-serif'>No copy of this email was kept.</p>", {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "sandbox; default-src 'none'; img-src * data:; style-src 'unsafe-inline' *; font-src *",
      "x-content-type-options": "nosniff",
      "cache-control": "no-store",
    },
  });
}
