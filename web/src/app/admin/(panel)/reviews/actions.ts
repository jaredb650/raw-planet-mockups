"use server";

import { videoEmbed } from "@/lib/video";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { reviews } from "@/lib/db/schema";
import { adminAction, bool, int, optStr, str } from "@/lib/admin/action";
import { fromLocal } from "@/lib/time";
import type { ActionResult } from "@/components/admin/types";

const id = (fd: FormData) => z.string().min(1).parse(str(fd, "id"));
const publicPages = () => revalidatePath("/", "layout");

export async function setReviewStatusAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const status = z.enum(["published", "hidden", "pending"]).parse(str(fd, "status"));
    const db = await getDb();
    await db.update(reviews).set({ status, ...(status !== "published" ? { featured: false } : {}) }).where(eq(reviews.id, id(fd)));
    publicPages();
    return status === "published" ? "Published on the website." : status === "hidden" ? "Hidden from the website." : "Moved back to waiting.";
  });
}

export async function featureReviewAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const featured = bool(fd, "featured");
    const db = await getDb();
    await db.update(reviews).set({ featured, ...(featured ? { status: "published" as const } : {}) }).where(eq(reviews.id, id(fd)));
    publicPages();
    return featured ? "Featured on the home page." : "No longer featured.";
  });
}

export async function replyReviewAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const reply = str(fd, "reply").slice(0, 2000);
    const db = await getDb();
    await db.update(reviews).set({ hostReply: reply || null }).where(eq(reviews.id, id(fd)));
    publicPages();
    return reply ? "Reply saved." : "Reply removed.";
  });
}

/** Attach (or clear) a guest's video testimonial. */
export async function videoReviewAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const url = str(fd, "videoUrl").trim();
    if (url && !videoEmbed(url)) throw new Error("Use a YouTube or Vimeo link, or a direct .mp4 link.");
    const db = await getDb();
    await db.update(reviews).set({ videoUrl: url || null }).where(eq(reviews.id, id(fd)));
    publicPages();
    return url ? "Video added." : "Video removed.";
  });
}

export async function deleteReviewAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const db = await getDb();
    await db.delete(reviews).where(eq(reviews.id, id(fd)));
    publicPages();
    return "Review deleted.";
  });
}

/** Copy in a review from Airbnb / Google / Viator so it shows on the site. */
export async function addReviewAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const v = z
      .object({
        name: z.string().min(1, "Who wrote it?").max(80),
        body: z.string().min(5, "Paste the review text").max(4000),
        source: z.enum(["airbnb", "google", "viator", "direct"]),
      })
      .parse({ name: str(fd, "name"), body: str(fd, "body"), source: str(fd, "source") });
    const rating = int(fd, "rating");
    if (rating < 1 || rating > 5) throw new Error("Rating is 1 to 5 stars.");
    const date = str(fd, "reviewDate");
    const videoUrl = str(fd, "videoUrl").trim();
    if (videoUrl && !videoEmbed(videoUrl)) throw new Error("Use a YouTube or Vimeo link, or a direct .mp4 link.");
    const db = await getDb();
    await db.insert(reviews).values({
      videoUrl: videoUrl || null,
      ...v,
      rating,
      location: optStr(fd, "location"),
      experienceId: optStr(fd, "experienceId"),
      reviewDate: /^\d{4}-\d{2}-\d{2}$/.test(date) ? fromLocal(date, "12:00") : new Date(),
      status: bool(fd, "publish") ? "published" : "pending",
    });
    publicPages();
    return "Review added.";
  });
}
