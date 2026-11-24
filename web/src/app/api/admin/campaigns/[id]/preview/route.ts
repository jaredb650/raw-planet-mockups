import { eq } from "drizzle-orm";
import { adminGuard } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { campaignPreviewHtml } from "@/lib/admin/campaigns";

export const dynamic = "force-dynamic";

/** The campaign as guests will see it, for the admin preview iframe. Sandboxed like the sent-email preview. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id } = await ctx.params;
  const db = await getDb();
  const [c] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (!c) return new Response("Not found", { status: 404 });
  return new Response(await campaignPreviewHtml(c), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "sandbox; default-src 'none'; img-src * data:; style-src 'unsafe-inline' *; font-src *",
      "x-content-type-options": "nosniff",
      "cache-control": "no-store",
    },
  });
}
