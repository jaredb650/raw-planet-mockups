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
    await db
      .update(customers)
      .set({ name: v.name, phone: v.phone || null, notes: v.notes, language: v.language, marketingOptIn: bool(fd, "marketingOptIn"), updatedAt: new Date() })
      .where(eq(customers.id, id));
    return "Saved.";
  });
}
