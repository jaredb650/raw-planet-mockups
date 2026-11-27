"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { bookings, campaignRecipients, customers } from "@/lib/db/schema";
import { adminAction, bool, str } from "@/lib/admin/action";
import { parsePhone } from "@/lib/phone";
import type { ActionResult } from "@/components/admin/types";

export async function updateCustomerAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const id = z.string().min(1).parse(str(fd, "id"));
    const v = z
      .object({
        name: z.string().min(1, "Name is required").max(120),
        notes: z.string().max(5000),
        language: z.enum(["en", "es"]),
      })
      .parse({ name: str(fd, "name"), notes: str(fd, "notes"), language: str(fd, "language") || "en" });
    const rawEmail = str(fd, "email").trim().toLowerCase();
    const phone = parsePhone(str(fd, "phone"), "Phone");
    const db = await getDb();
    const [c] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    if (!c) throw new Error("Customer not found.");

    let nextEmail = c.email;
    if (rawEmail && rawEmail !== c.email) {
      nextEmail = z.email("That email doesn't look right").max(200).parse(rawEmail);
      const [conflict] = await db
        .select({ id: customers.id, name: customers.name })
        .from(customers)
        .where(and(eq(customers.email, nextEmail), ne(customers.id, id)))
        .limit(1);
      if (conflict) {
        throw new Error(`${conflict.name} already uses ${nextEmail}. Use “Merge duplicate” below to combine these profiles.`);
      }
    }

    await db
      .update(customers)
      .set({
        name: v.name,
        email: nextEmail,
        phone: phone || null,
        notes: v.notes,
        language: v.language,
        marketingOptIn: bool(fd, "marketingOptIn") && !c.unsubscribedAt,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id));
    return "Saved.";
  });
}

export async function mergeCustomerAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const sourceId = z.string().min(1).parse(str(fd, "sourceId"));
    const targetId = str(fd, "targetId").trim();
    const rawEmail = str(fd, "targetEmail").trim().toLowerCase();
    if (!targetId && !rawEmail) throw new Error("Choose a customer or enter their email to merge into.");
    const db = await getDb();
    const [source] = await db.select().from(customers).where(eq(customers.id, sourceId)).limit(1);
    if (!source) throw new Error("Customer not found.");
    const [target] = rawEmail
      ? await db
          .select()
          .from(customers)
          .where(eq(customers.email, z.email("That email doesn't look right").parse(rawEmail)))
          .limit(1)
      : await db.select().from(customers).where(eq(customers.id, targetId)).limit(1);
    if (!target) throw new Error(rawEmail ? `No customer found with email ${rawEmail}.` : "Target customer not found.");
    if (target.id === source.id) throw new Error("Pick a different customer profile to merge into.");

    await db.transaction(async (tx) => {
      await tx.update(bookings).set({ customerId: target.id }).where(eq(bookings.customerId, source.id));
      await tx.update(campaignRecipients).set({ customerId: target.id }).where(eq(campaignRecipients.customerId, source.id));
      const mergedTags = [...new Set([...target.tags, ...source.tags])];
      const mergedNotes = [target.notes.trim(), source.notes.trim()].filter(Boolean).join("\n\n");
      const unsubscribedAt =
        target.unsubscribedAt && source.unsubscribedAt
          ? target.unsubscribedAt < source.unsubscribedAt
            ? target.unsubscribedAt
            : source.unsubscribedAt
          : (target.unsubscribedAt ?? source.unsubscribedAt);
      const marketingOptIn = !unsubscribedAt && (target.marketingOptIn || source.marketingOptIn);
      await tx
        .update(customers)
        .set({
          phone: target.phone ?? source.phone,
          tags: mergedTags,
          notes: mergedNotes,
          unsubscribedAt,
          marketingOptIn,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, target.id));
      await tx.delete(customers).where(eq(customers.id, source.id));
    });

    revalidatePath("/admin/customers");
    redirect(`/admin/customers/${target.id}?merged=1`);
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
