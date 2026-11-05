"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { adminAction, bool, str } from "@/lib/admin/action";
import type { ActionResult } from "@/components/admin/types";

export async function updateCustomerAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const id = z.string().min(1).parse(str(fd, "id"));
    const v = z
      .object({
        name: z.string().min(1, "Name is required").max(120),
        phone: z.string().max(40),
        notes: z.string().max(5000),
        language: z.enum(["en", "es"]),
      })
      .parse({ name: str(fd, "name"), phone: str(fd, "phone"), notes: str(fd, "notes"), language: str(fd, "language") || "en" });
    const db = await getDb();
    const [c] = await db.select({ unsubscribedAt: customers.unsubscribedAt }).from(customers).where(eq(customers.id, id)).limit(1);
    await db
      .update(customers)
      .set({ name: v.name, phone: v.phone || null, notes: v.notes, language: v.language, marketingOptIn: bool(fd, "marketingOptIn") && !c?.unsubscribedAt, updatedAt: new Date() })
      .where(eq(customers.id, id));
    return "Saved.";
  });
}

/** Lowercase so "VIP" and "vip" can't become two segments. */
const tagSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, " ").toLowerCase())
  .pipe(z.string().min(1, "Type a tag first.").max(40, "Keep tags under 40 characters."));

async function setTags(id: string, change: (tags: string[]) => string[]) {
  const db = await getDb();
  const [c] = await db.select({ tags: customers.tags }).from(customers).where(eq(customers.id, id)).limit(1);
  if (!c) throw new Error("Customer not found.");
  await db.update(customers).set({ tags: change(c.tags), updatedAt: new Date() }).where(eq(customers.id, id));
}

export async function addTagAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const tag = tagSchema.parse(str(fd, "tag"));
    await setTags(str(fd, "id"), (tags) => (tags.includes(tag) ? tags : [...tags, tag]));
    return `Tagged “${tag}”.`;
  });
}

export async function removeTagAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const tag = str(fd, "tag");
    await setTags(str(fd, "id"), (tags) => tags.filter((t) => t !== tag));
    return "Tag removed.";
  });
}
