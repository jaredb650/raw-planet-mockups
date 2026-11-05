"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, max } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { addons, experiences, type DurationOption, type WeeklySchedule } from "@/lib/db/schema";
import { adminAction, bool, cents, int, lines, optInt, optStr, str } from "@/lib/admin/action";
import { parseDollars } from "@/lib/money";
import type { ActionResult } from "@/components/admin/types";

const THEMES = ["production", "dj", "wellness"] as const;
const hhmm = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;

function parseDurations(fd: FormData): DurationOption[] {
  const mins = fd.getAll("durMinutes").map(String);
  const prices = fd.getAll("durPrice").map(String);
  const labels = fd.getAll("durLabel").map(String);
  const out: DurationOption[] = [];
  mins.forEach((m, i) => {
    const mm = m.trim();
    const p = (prices[i] ?? "").trim();
    if (!mm && !p) return;
    const minutes = Number(mm);
    if (!Number.isInteger(minutes) || minutes < 15 || minutes > 24 * 60) throw new Error(`Length ${i + 1}: enter minutes (e.g. 120).`);
    const price = parseDollars(p);
    if (price === null) throw new Error(`Length ${i + 1}: enter a price.`);
    const label = (labels[i] ?? "").trim();
    out.push({ minutes, priceCents: price, ...(label ? { label } : {}) });
  });
  if (!out.length) throw new Error("Add at least one session length with a price.");
  if (new Set(out.map((o) => o.minutes)).size !== out.length) throw new Error("Two session lengths are the same.");
  return out.sort((a, b) => a.minutes - b.minutes);
}

function parseSchedule(fd: FormData): WeeklySchedule {
  const s: WeeklySchedule = {};
  for (let d = 0; d < 7; d++) {
    const wins: { start: string; end: string }[] = [];
    for (let w = 0; w < 2; w++) {
      const start = str(fd, `h_${d}_${w}_start`);
      const end = str(fd, `h_${d}_${w}_end`);
      if (!start && !end) continue;
      if (!hhmm.test(start) || !hhmm.test(end)) throw new Error("Opening hours: fill both the start and end time.");
      const endNorm = end === "00:00" ? "24:00" : end;
      if (endNorm <= start) throw new Error("Opening hours: a closing time is before its opening time.");
      wins.push({ start, end: endNorm });
    }
    if (wins.length) s[String(d)] = wins.sort((a, b) => a.start.localeCompare(b.start));
  }
  return s;
}

export async function updateExperienceAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const id = z.string().min(1).parse(str(fd, "id"));
    const name = z.string().min(2, "Name is required").max(120).parse(str(fd, "name"));
    const minGuests = int(fd, "minGuests");
    const maxGuests = int(fd, "maxGuests");
    if (minGuests < 1 || maxGuests < minGuests) throw new Error("Guests: the maximum must be at least the minimum.");
    const pricingMode = z.enum(["per_person", "per_session"]).parse(str(fd, "pricingMode"));
    const airbnbUrl = optStr(fd, "airbnbUrl");
    if (airbnbUrl) z.url("Airbnb link must be a full https:// link").parse(airbnbUrl);
    const values = {
      name,
      shortName: str(fd, "shortName") || name,
      tagline: str(fd, "tagline").slice(0, 200),
      summary: str(fd, "summary").slice(0, 600),
      description: str(fd, "description").slice(0, 8000),
      theme: z.enum(THEMES).parse(str(fd, "theme")),
      active: bool(fd, "active"),
      waiverRequired: bool(fd, "waiverRequired"),
      sortOrder: int(fd, "sortOrder", 0),
      pricingMode,
      durationOptions: parseDurations(fd),
      includedGuests: pricingMode === "per_session" ? Math.max(1, int(fd, "includedGuests", 1)) : 1,
      extraGuestCents: pricingMode === "per_session" ? cents(fd, "extraGuest", 0) : 0,
      minGuests,
      maxGuests,
      minAge: optInt(fd, "minAge"),
      schedule: parseSchedule(fd),
      slotStepMinutes: z.number().int().min(15).max(720).parse(int(fd, "slotStepMinutes")),
      bufferMinutes: z.number().int().min(0).max(240).parse(int(fd, "bufferMinutes", 0)),
      leadTimeHours: z.number().int().min(0).max(24 * 30).parse(int(fd, "leadTimeHours", 0)),
      maxAdvanceDays: z.number().int().min(1).max(730).parse(int(fd, "maxAdvanceDays")),
      cancellationHours: z.number().int().min(0).max(24 * 30).parse(int(fd, "cancellationHours", 0)),
      locationArea: str(fd, "locationArea") || "New York, NY",
      address: str(fd, "address"),
      arrivalInstructions: str(fd, "arrivalInstructions").slice(0, 2000),
      highlights: lines(fd, "highlights").slice(0, 20),
      includes: lines(fd, "includes").slice(0, 20),
      goodToKnow: lines(fd, "goodToKnow").slice(0, 20),
      calEventTypeId: optInt(fd, "calEventTypeId"),
      airbnbUrl,
      updatedAt: new Date(),
    };
    const db = await getDb();
    const [row] = await db.update(experiences).set(values).where(eq(experiences.id, id)).returning({ slug: experiences.slug });
    if (!row) throw new Error("Experience not found.");
    // The public pages read experiences too.
    revalidatePath("/", "layout");
    return values.active ? "Saved. Live on the website." : "Saved. Hidden from the website.";
  });
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60) || "experience";

export async function createExperienceAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const name = z.string().min(2, "Give it a name").max(120).parse(str(fd, "name"));
    const db = await getDb();
    let slug = slugify(name);
    for (let i = 2; ; i++) {
      const [taken] = await db.select({ id: experiences.id }).from(experiences).where(eq(experiences.slug, slug)).limit(1);
      if (!taken) break;
      slug = `${slugify(name)}-${i}`;
    }
    const [{ m }] = await db.select({ m: max(experiences.sortOrder) }).from(experiences);
    const [row] = await db
      .insert(experiences)
      .values({
        slug,
        name,
        shortName: name,
        theme: "production",
        active: false,
        sortOrder: (m ?? 0) + 1,
        durationOptions: [{ minutes: 120, priceCents: 30000 }],
        schedule: { "1": [{ start: "10:00", end: "22:00" }], "2": [{ start: "10:00", end: "22:00" }], "3": [{ start: "10:00", end: "22:00" }], "4": [{ start: "10:00", end: "22:00" }], "5": [{ start: "10:00", end: "22:00" }], "6": [{ start: "10:00", end: "22:00" }], "0": [{ start: "10:00", end: "22:00" }] },
      })
      .returning({ id: experiences.id });
    const newId = row.id;
    revalidatePath("/admin", "layout");
    redirect(`/admin/experiences/${newId}?created=1`);
  });
}

/* ------------------------------ add-ons ------------------------------ */

export async function saveAddonAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const id = optStr(fd, "id");
    const v = {
      name: z.string().min(1, "Name the add-on").max(80).parse(str(fd, "name")),
      description: str(fd, "description").slice(0, 300),
      priceCents: cents(fd, "price"),
      pricing: z.enum(["per_booking", "per_guest"]).parse(str(fd, "pricing") || "per_booking"),
      experienceId: optStr(fd, "experienceId"),
      active: bool(fd, "active"),
    };
    const db = await getDb();
    if (id) await db.update(addons).set(v).where(eq(addons.id, id));
    else await db.insert(addons).values(v);
    revalidatePath("/", "layout");
    return id ? "Add-on saved." : "Add-on added.";
  });
}

export async function deleteAddonAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const db = await getDb();
    await db.delete(addons).where(eq(addons.id, z.string().min(1).parse(str(fd, "id"))));
    revalidatePath("/", "layout");
    return "Add-on removed.";
  });
}
