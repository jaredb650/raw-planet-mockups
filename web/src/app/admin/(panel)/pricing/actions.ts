"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pricingRules } from "@/lib/db/schema";
import { adminAction, bool, int, optInt, optStr, str } from "@/lib/admin/action";
import { DISMISSED_SUGGESTIONS_KEY, ruleProblem, type DismissedMap } from "@/lib/admin/pricing";
import { getSetting, setSetting } from "@/lib/automation/settings";
import type { ActionResult } from "@/components/admin/types";

function parsePercent(fd: FormData): number {
  const raw = str(fd, "percent")
    .replace(/[−–—]/g, "-")
    .replace(/^\+/, "")
    .replace(/%$/, "")
    .trim();
  if (!raw) throw new Error("Price change (%) is required.");
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error("Price change (%) must be a whole number.");
  return n;
}

function parse(fd: FormData) {
  const experienceIds = fd.getAll("experienceIds").map(String).filter(Boolean);
  const weekdays = fd.getAll("weekdays").map(Number);
  const v = {
    name: str(fd, "name").slice(0, 80),
    adjustPercent: parsePercent(fd),
    weekdays: weekdays.length ? weekdays : null,
    startTime: optStr(fd, "startTime"),
    endTime: optStr(fd, "endTime"),
    dateFrom: optStr(fd, "dateFrom"),
    dateTo: optStr(fd, "dateTo"),
    minHoursAhead: optInt(fd, "minHoursAhead"),
    maxHoursAhead: optInt(fd, "maxHoursAhead"),
  };
  const problem = ruleProblem(v);
  if (problem) throw new Error(problem);
  return { ...v, experienceIds: experienceIds.length ? experienceIds : null, priority: int(fd, "priority", 0), active: bool(fd, "active") };
}

export async function saveRuleAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(
    async () => {
      const id = optStr(fd, "id");
      const v = parse(fd);
      const db = await getDb();
      if (id) await db.update(pricingRules).set({ ...v, updatedAt: new Date() }).where(eq(pricingRules.id, id));
      else await db.insert(pricingRules).values(v);
      return v.active ? `${v.name} saved and live.` : `${v.name} saved. It's off until you turn it on.`;
    },
    { revalidate: ["/", "/admin"] },
  );
}

export async function toggleRuleAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(
    async () => {
      const db = await getDb();
      const active = bool(fd, "active");
      await db.update(pricingRules).set({ active, updatedAt: new Date() }).where(eq(pricingRules.id, str(fd, "id")));
      return active ? "Rule turned on." : "Rule turned off.";
    },
    { revalidate: ["/", "/admin"] },
  );
}

export async function deleteRuleAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(
    async () => {
      const db = await getDb();
      await db.delete(pricingRules).where(eq(pricingRules.id, str(fd, "id")));
      return "Rule deleted. Past bookings keep the price they paid.";
    },
    { revalidate: ["/", "/admin"] },
  );
}

export async function dismissSuggestionAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(
    async () => {
      const key = str(fd, "key");
      if (!key) throw new Error("Missing suggestion key.");
      const days = optInt(fd, "days");
      const current = (await getSetting<DismissedMap>(DISMISSED_SUGGESTIONS_KEY)) ?? {};
      const next: DismissedMap = { ...current };
      next[key] = days && days > 0 ? new Date(Date.now() + days * 86400_000).toISOString() : null;
      await setSetting(DISMISSED_SUGGESTIONS_KEY, next);
      return days && days > 0 ? `Snoozed for ${days} days.` : "Suggestion dismissed.";
    },
    { revalidate: ["/admin/pricing"] },
  );
}

export async function restoreSuggestionsAction(): Promise<ActionResult> {
  return adminAction(
    async () => {
      await setSetting(DISMISSED_SUGGESTIONS_KEY, {});
      return "Dismissed suggestions restored.";
    },
    { revalidate: ["/admin/pricing"] },
  );
}
