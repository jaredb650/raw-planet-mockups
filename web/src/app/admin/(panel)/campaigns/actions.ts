"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { adminAction, int, str } from "@/lib/admin/action";
import { segmentFromForm, sendCampaignBatch, sendCampaignTest, startCampaign } from "@/lib/admin/campaigns";
import { integrations } from "@/lib/config";
import type { ActionResult } from "@/components/admin/types";

export async function createCampaignAction(): Promise<ActionResult> {
  return adminAction(async () => {
    const db = await getDb();
    const [c] = await db.insert(campaigns).values({ name: "Untitled campaign", subject: "", body: "" }).returning({ id: campaigns.id });
    redirect(`/admin/campaigns/${c.id}`);
  });
}

async function saveDraftFromForm(fd: FormData) {
  const v = z
    .object({
      name: z.string().min(1, "Give it a name").max(120),
      subject: z.string().max(150, "Keep the subject under 150 characters"),
      body: z.string().max(10_000, "That message is too long"),
    })
    .parse({ name: str(fd, "name"), subject: str(fd, "subject"), body: str(fd, "body") });
  const db = await getDb();
  const [saved] = await db
    .update(campaigns)
    .set({ ...v, segment: segmentFromForm(fd), updatedAt: new Date() })
    .where(and(eq(campaigns.id, str(fd, "id")), eq(campaigns.status, "draft")))
    .returning();
  if (!saved) throw new Error("This campaign has already gone out, so it can't be edited.");
  return saved;
}

export async function saveCampaignAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    await saveDraftFromForm(fd);
    return "Saved.";
  });
}

export async function testCampaignAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const rawTo = str(fd, "to");
    const to = rawTo ? z.email("Enter a valid email address").max(200).parse(rawTo) : undefined;
    const db = await getDb();
    const c = fd.has("name")
      ? await saveDraftFromForm(fd)
      : (await db.select().from(campaigns).where(eq(campaigns.id, str(fd, "id"))).limit(1))[0];
    if (!c) throw new Error("Campaign not found.");
    if (!c.subject.trim() || !c.body.trim()) throw new Error("Add a subject and a message first.");
    const r = await sendCampaignTest(c, to);
    if (!r.ok) throw new Error(`The test didn't send: ${r.error ?? "unknown error"}`);
    return integrations.resend() ? `Saved & test sent to ${r.to}.` : "Saved. Test mode: nothing was delivered — check Emails.";
  });
}

function sendMessage(r: { sent: number; failed: number; remaining: number }) {
  const done = `${r.sent} sent${r.failed ? `, ${r.failed} failed` : ""}.`;
  return r.remaining ? `${done} ${r.remaining} still to go.` : done;
}

export async function sendCampaignAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const id = str(fd, "id");
    if (fd.has("name")) await saveDraftFromForm(fd);
    await startCampaign(id, int(fd, "expected"));
    return sendMessage(await sendCampaignBatch(id));
  });
}

export async function deleteCampaignAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const id = z.string().min(1).parse(str(fd, "id"));
    const db = await getDb();
    const [deleted] = await db
      .delete(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.status, "draft")))
      .returning({ id: campaigns.id });
    if (!deleted) throw new Error("Only draft campaigns can be deleted.");
    revalidatePath("/admin/campaigns");
    redirect("/admin/campaigns");
  });
}

/** "Send the next batch": lets Alex finish a big list now instead of waiting for the daily run. */
export async function continueCampaignAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => sendMessage(await sendCampaignBatch(str(fd, "id"))));
}
