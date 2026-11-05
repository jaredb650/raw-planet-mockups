import { ZodError } from "zod";
import { adminGuard } from "@/lib/auth";
import { countRecipients, segmentFromForm } from "@/lib/admin/campaigns";

export const dynamic = "force-dynamic";

/** Live recipient count for the segment builder. Takes the form's own fields. */
export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    return Response.json({ count: await countRecipients(segmentFromForm(await req.formData())) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ZodError) return Response.json({ error: "Check the numbers." }, { status: 400 });
    throw err;
  }
}
