"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { promoCodes } from "@/lib/db/schema";
import { adminAction, bool, cents, int, optInt, optStr, str } from "@/lib/admin/action";
import { addDaysKey, fromLocal } from "@/lib/time";
import type { ActionResult } from "@/components/admin/types";

const dateKey = /^\d{4}-\d{2}-\d{2}$/;

function parse(fd: FormData) {
  const code = z
    .string()
    .min(3, "Codes need at least 3 characters")
    .max(30)
    .regex(/^[A-Z0-9_-]+$/, "Use letters, numbers, - or _ only")
    .parse(str(fd, "code").toUpperCase().replace(/\s+/g, ""));
  const hasPct = str(fd, "percent") !== "";
  const hasAmt = str(fd, "amount") !== "";
  if (hasPct === hasAmt) throw new Error(hasPct ? "Fill in percent off or amount off, not both." : "Fill in percent off or amount off.");
  const kind: "percent" | "fixed" = hasPct ? "percent" : "fixed";
  const value = kind === "percent" ? int(fd, "percent") : cents(fd, "amount");
  if (kind === "percent" && (value < 1 || value > 100)) throw new Error("Percent must be between 1 and 100.");
  if (kind === "fixed" && value < 100) throw new Error("Enter at least $1 off.");
  const from = str(fd, "validFrom");
  const until = str(fd, "validUntil");
  const exp = fd.getAll("experienceIds").map(String).filter(Boolean);
  return {
    code,
    kind,
    value,
    description: str(fd, "description").slice(0, 200),
    minSubtotalCents: cents(fd, "minSubtotal", 0),
    maxRedemptions: optInt(fd, "maxRedemptions"),
    validFrom: dateKey.test(from) ? fromLocal(from) : null,
    validUntil: dateKey.test(until) ? fromLocal(addDaysKey(until, 1)) : null, // through the end of that day
    experienceIds: exp.length ? exp : null,
    active: bool(fd, "active"),
  };
}

export async function savePromoAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const id = optStr(fd, "id");
    const v = parse(fd);
    if (v.validFrom && v.validUntil && v.validUntil <= v.validFrom) throw new Error("The end date is before the start date.");
    const db = await getDb();
    const [clash] = await db.select({ id: promoCodes.id }).from(promoCodes).where(eq(promoCodes.code, v.code)).limit(1);
    if (clash && clash.id !== id) throw new Error(`${v.code} already exists.`);
    if (id) await db.update(promoCodes).set(v).where(eq(promoCodes.id, id));
    else await db.insert(promoCodes).values(v);
    return id ? `${v.code} saved.` : `${v.code} created${v.active ? " and live" : ""}.`;
  });
}

export async function togglePromoAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const db = await getDb();
    const active = bool(fd, "active");
    await db.update(promoCodes).set({ active }).where(eq(promoCodes.id, str(fd, "id")));
    return active ? "Code turned on." : "Code turned off.";
  });
}

export async function deletePromoAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const db = await getDb();
    const [p] = await db.select().from(promoCodes).where(eq(promoCodes.id, str(fd, "id"))).limit(1);
    if (!p) return "Already deleted.";
    if (p.redemptions > 0) throw new Error("This code has been used, so it's kept for your records. Turn it off instead.");
    await db.delete(promoCodes).where(eq(promoCodes.id, p.id));
    return "Code deleted.";
  });
}
