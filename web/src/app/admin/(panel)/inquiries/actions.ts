"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { inquiries } from "@/lib/db/schema";
import { adminAction, str } from "@/lib/admin/action";
import type { ActionResult } from "@/components/admin/types";

const LABEL = { new: "Moved back to new.", replied: "Marked as replied.", converted: "Marked as booked.", closed: "Closed." } as const;

export async function setInquiryStatusAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const status = z.enum(["new", "replied", "converted", "closed"]).parse(str(fd, "status"));
    const db = await getDb();
    await db.update(inquiries).set({ status }).where(eq(inquiries.id, z.string().min(1).parse(str(fd, "id"))));
    return LABEL[status];
  });
}
