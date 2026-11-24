"use server";

import { seriesDates } from "@/lib/admin/schedule";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { eventRsvps, events } from "@/lib/db/schema";
import { newToken } from "@/lib/ids";
import { adminAction, bool, cents, int, optInt, optStr, str } from "@/lib/admin/action";
import { addDaysKey, fromLocal, localDateKey } from "@/lib/time";
import type { ActionResult } from "@/components/admin/types";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const time = z.string().regex(/^\d{2}:\d{2}$/, "Pick a time");
const optUrl = (fd: FormData, k: string, label: string) => {
  const v = optStr(fd, k);
  if (v) z.url(`${label} must be a full https:// link`).parse(v);
  return v;
};
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60) || "event";

/** Fields shared by every event in a series (no dates, slug or status). */
function sharedFields(fd: FormData) {
  return {
    title: z.string().min(2, "Give the event a title").max(140).parse(str(fd, "title")),
    summary: str(fd, "summary").slice(0, 400),
    description: str(fd, "description").slice(0, 8000),
    venue: str(fd, "venue").slice(0, 140),
    address: str(fd, "address").slice(0, 300),
    imageUrl: optStr(fd, "imageUrl"),
    meetupUrl: optUrl(fd, "meetupUrl", "Meetup link"),
    externalTicketUrl: optUrl(fd, "externalTicketUrl", "Ticket link"),
    rsvpEnabled: bool(fd, "rsvpEnabled"),
    priceCents: cents(fd, "price", 0),
    capacity: optInt(fd, "capacity"),
  };
}

function times(fd: FormData, day: string) {
  const start = fromLocal(day, time.parse(str(fd, "startTime")));
  let end = fromLocal(day, time.parse(str(fd, "endTime")));
  if (end <= start) end = fromLocal(addDaysKey(day, 1), str(fd, "endTime")); // runs past midnight
  return { startAt: start, endAt: end };
}

async function uniqueSlug(base: string): Promise<string> {
  const db = await getDb();
  let slug = base;
  for (let i = 2; ; i++) {
    const [taken] = await db.select({ id: events.id }).from(events).where(eq(events.slug, slug)).limit(1);
    if (!taken) return slug;
    slug = `${base}-${i}`;
  }
}

export async function createEventAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const shared = sharedFields(fd);
    const first = dateKey.parse(str(fd, "date"));
    const repeat = z.enum(["none", "weekly", "biweekly", "monthly"]).parse(str(fd, "repeat") || "none");
    const count = repeat === "none" ? 1 : Math.max(2, Math.min(26, int(fd, "occurrences", 6)));
    const status = bool(fd, "publish") ? ("published" as const) : ("draft" as const);
    const seriesId = repeat === "none" ? null : `series_${newToken().slice(0, 12)}`;
    const db = await getDb();
    const ids: string[] = [];
    for (const day of seriesDates(first, repeat, count)) {
      const slug = await uniqueSlug(seriesId ? `${slugify(shared.title)}-${day}` : slugify(shared.title));
      const [row] = await db
        .insert(events)
        .values({ ...shared, ...times(fd, day), slug, status, seriesId })
        .returning({ id: events.id });
      ids.push(row.id);
    }
    const firstId = ids[0];
    revalidatePath("/", "layout");
    redirect(`/admin/events/${firstId}?created=1`);
  });
}

export async function updateEventAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const id = z.string().min(1).parse(str(fd, "id"));
    const shared = sharedFields(fd);
    const status = z.enum(["draft", "published", "cancelled"]).parse(str(fd, "status"));
    const db = await getDb();
    const [ev] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!ev) throw new Error("Event not found.");
    const day = dateKey.parse(str(fd, "date"));
    await db
      .update(events)
      .set({ ...shared, ...times(fd, day), status, updatedAt: new Date() })
      .where(eq(events.id, id));
    let others = 0;
    if (ev.seriesId && bool(fd, "applyToSeries")) {
      // Same details and clock times for every later event in the series (each keeps its own date).
      const later = await db
        .select({ id: events.id, startAt: events.startAt })
        .from(events)
        .where(and(eq(events.seriesId, ev.seriesId), gte(events.startAt, ev.startAt), sql`${events.id} <> ${id}`));
      for (const o of later) {
        await db
          .update(events)
          .set({ ...shared, ...times(fd, localDateKey(o.startAt)), updatedAt: new Date() })
          .where(eq(events.id, o.id));
      }
      others = later.length;
    }
    revalidatePath("/", "layout");
    return others ? `Saved, and updated ${others} later date${others === 1 ? "" : "s"} in the series.` : "Saved.";
  });
}

export async function extendSeriesAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const seriesId = z.string().min(1).parse(str(fd, "seriesId"));
    const weeks = z.coerce.number().int().min(1).max(4).parse(str(fd, "everyWeeks") || "2");
    const more = Math.max(1, Math.min(26, int(fd, "more", 6)));
    const db = await getDb();
    const series = await db.select().from(events).where(eq(events.seriesId, seriesId)).orderBy(sql`${events.startAt} desc`).limit(1);
    const last = series[0];
    if (!last) throw new Error("Series not found.");
    const startClock = new Intl.DateTimeFormat("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false });
    const startT = startClock.format(last.startAt);
    const endT = startClock.format(last.endAt);
    const lastDay = localDateKey(last.startAt);
    const copy = {
      title: last.title,
      summary: last.summary,
      description: last.description,
      venue: last.venue,
      address: last.address,
      imageUrl: last.imageUrl,
      meetupUrl: last.meetupUrl,
      externalTicketUrl: last.externalTicketUrl,
      rsvpEnabled: last.rsvpEnabled,
      priceCents: last.priceCents,
      capacity: last.capacity,
      seriesId: last.seriesId,
      status: last.status === "cancelled" ? ("published" as const) : last.status,
    };
    for (let i = 1; i <= more; i++) {
      const day = addDaysKey(lastDay, 7 * weeks * i);
      const startAt = fromLocal(day, startT);
      let endAt = fromLocal(day, endT);
      if (endAt <= startAt) endAt = fromLocal(addDaysKey(day, 1), endT);
      await db.insert(events).values({ ...copy, slug: await uniqueSlug(`${slugify(last.title)}-${day}`), startAt, endAt });
    }
    revalidatePath("/", "layout");
    return `Added ${more} more date${more === 1 ? "" : "s"}.`;
  });
}

export async function deleteEventAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const id = z.string().min(1).parse(str(fd, "id"));
    const db = await getDb();
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(eventRsvps).where(and(eq(eventRsvps.eventId, id), eq(eventRsvps.status, "going")));
    if (Number(n) > 0) throw new Error("People have RSVP’d. Cancel the event instead so they can be told.");
    await db.delete(events).where(eq(events.id, id));
    revalidatePath("/", "layout");
    redirect("/admin/events");
  });
}

export async function cancelRsvpAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const db = await getDb();
    await db.update(eventRsvps).set({ status: "cancelled" }).where(eq(eventRsvps.id, z.string().min(1).parse(str(fd, "id"))));
    revalidatePath("/", "layout");
    return "RSVP cancelled.";
  });
}

export async function addRsvpAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const eventId = z.string().min(1).parse(str(fd, "eventId"));
    const name = z.string().min(1, "Name required").max(120).parse(str(fd, "name"));
    const email = z.email("Enter an email").parse(str(fd, "email").toLowerCase());
    const guests = Math.max(1, Math.min(20, int(fd, "guests", 1)));
    const db = await getDb();
    await db
      .insert(eventRsvps)
      .values({ eventId, name, email, guests, status: "going" })
      .onConflictDoUpdate({ target: [eventRsvps.eventId, eventRsvps.email], set: { name, guests, status: "going" } });
    revalidatePath("/", "layout");
    return `${name} added to the list.`;
  });
}
