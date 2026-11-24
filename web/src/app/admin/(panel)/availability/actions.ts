"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { blocks, calendarFeeds, experiences } from "@/lib/db/schema";
import { adminAction, bool, int, optStr, str } from "@/lib/admin/action";
import { clearFeedBlocks, normalizeFeedUrl, previewCalendarFeed, syncCalendarFeeds } from "@/lib/feeds";
import { plural } from "@/components/admin/format";
import { regenerateCalendarFeedToken } from "@/lib/calendar-feed";
import { fmtDateShort, fromLocal } from "@/lib/time";
import { blockSpans } from "@/lib/admin/schedule";
import type { ActionResult } from "@/components/admin/types";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const time = z.string().regex(/^\d{2}:\d{2}$/, "Pick a time");

async function resourceGroups(experienceId: string | null): Promise<string[]> {
  const db = await getDb();
  if (experienceId) {
    const [x] = await db.select({ g: experiences.resourceGroup }).from(experiences).where(eq(experiences.id, experienceId)).limit(1);
    if (!x) throw new Error("Experience not found.");
    return [x.g];
  }
  const rows = await db.selectDistinct({ g: experiences.resourceGroup }).from(experiences);
  return rows.length ? rows.map((r) => r.g) : ["alex"];
}

/** Block time off. Supports all-day, multi-day ranges and weekly repeats. */
export async function createBlockAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const allDay = bool(fd, "allDay");
    const startDate = dateKey.parse(str(fd, "startDate"));
    const endDate = dateKey.parse(str(fd, "endDate") || startDate);
    if (endDate < startDate) throw new Error("The end date is before the start date.");
    const startTime = allDay ? "00:00" : time.parse(str(fd, "startTime"));
    const endTime = allDay ? "00:00" : time.parse(str(fd, "endTime"));
    const repeat = Math.max(0, Math.min(52, int(fd, "repeatWeeks", 0)));
    const spans = blockSpans({ startDate, endDate, startTime, endTime, allDay, repeatWeeks: repeat });
    if (spans[0].e <= spans[0].s) throw new Error("The end time must be after the start time.");
    const experienceId = optStr(fd, "experienceId");
    const reason = str(fd, "reason").slice(0, 200);
    const groups = await resourceGroups(experienceId);
    const db = await getDb();
    const rows = [];
    for (const { s, e } of spans) {
      for (const g of groups) rows.push({ startAt: s, endAt: e, resourceGroup: g, experienceId, reason, source: "manual" as const });
    }
    await db.insert(blocks).values(rows);
    return repeat
      ? `Blocked ${repeat + 1} weeks from ${fmtDateShort(fromLocal(startDate, "12:00"))}.`
      : `Blocked ${fmtDateShort(fromLocal(startDate, "12:00"))}${endDate !== startDate ? ` to ${fmtDateShort(fromLocal(endDate, "12:00"))}` : ""}.`;
  });
}

export async function deleteBlockAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const id = z.string().min(1).parse(str(fd, "id"));
    const db = await getDb();
    const [b] = await db.select().from(blocks).where(eq(blocks.id, id)).limit(1);
    if (!b) return "Already removed.";
    if (b.source !== "manual") throw new Error("This comes from a synced calendar. Remove it there; it disappears here on the next sync.");
    // Remove the twin rows created for other resource groups at the same time.
    await db
      .delete(blocks)
      .where(and(eq(blocks.source, "manual"), eq(blocks.startAt, b.startAt), eq(blocks.endAt, b.endAt), eq(blocks.reason, b.reason)));
    return "Block removed. That time is bookable again.";
  });
}

/* ------------------------------- feeds -------------------------------- */

export async function addFeedAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const name = z.string().min(1, "Give the feed a name").max(80).parse(str(fd, "name"));
    const url = z.url("Paste the full iCal link (starts with https:// or webcal://)").parse(normalizeFeedUrl(str(fd, "url")));
    const check = await previewCalendarFeed(url);
    if (!check.ok) throw new Error(`Couldn’t read that calendar: ${check.error ?? "no response"}. Check the link and try again.`);
    const db = await getDb();
    const groups = await resourceGroups(null);
    const [row] = await db.insert(calendarFeeds).values({ name, url, resourceGroup: groups[0] ?? "alex" }).returning();
    const [r] = await syncCalendarFeeds(row.id);
    return r?.ok ? `Added ${name}: ${plural(r.events, "busy time")} now blocked.` : `Added ${name}, but the first sync failed: ${r?.error ?? "unknown error"}`;
  });
}

export async function toggleFeedAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const id = z.string().min(1).parse(str(fd, "id"));
    const active = bool(fd, "active");
    const db = await getDb();
    await db.update(calendarFeeds).set({ active, ...(active ? {} : { lastError: null }) }).where(eq(calendarFeeds.id, id));
    if (!active) {
      await clearFeedBlocks(id);
      return "Feed paused. Its busy times no longer block bookings.";
    }
    const [r] = await syncCalendarFeeds(id);
    return r?.ok ? `Feed back on: ${plural(r.events, "busy time")} blocked.` : `Feed on, but the sync failed: ${r?.error ?? "unknown error"}`;
  });
}

export async function deleteFeedAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const id = z.string().min(1).parse(str(fd, "id"));
    const db = await getDb();
    await db.delete(calendarFeeds).where(eq(calendarFeeds.id, id)); // its blocks cascade
    return "Feed removed. Its busy times are free again.";
  });
}

export async function syncFeedsAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const results = await syncCalendarFeeds(optStr(fd, "id") ?? undefined);
    if (results.length === 0) return "No calendar feeds to sync.";
    const failed = results.filter((r) => !r.ok);
    if (failed.length) throw new Error(failed.map((f) => `${f.name}: ${f.error ?? "failed"}`).join(" · "));
    const changes = results.reduce((n, r) => n + r.added + r.updated + r.removed, 0);
    return `Synced ${plural(results.length, "feed")}. ${changes ? `${plural(changes, "change")}.` : "No changes."}`;
  });
}

export async function regenerateFeedLinkAction(): Promise<ActionResult> {
  return adminAction(async () => {
    const url = await regenerateCalendarFeedToken();
    return { message: "New link created. The old one has stopped working, so re-subscribe with this one.", data: { url } };
  });
}
