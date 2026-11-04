/**
 * Read-only queries for public pages. Return plain serialisable objects that
 * are safe to pass to client components (no private address, no tokens).
 */
import "server-only";
import { and, asc, avg, count, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { addons, eventRsvps, events, experiences, reviews, type Experience } from "@/lib/db/schema";
import { BUSINESS } from "@/lib/config";

export type PublicExperience = Pick<
  Experience,
  | "id" | "slug" | "name" | "shortName" | "tagline" | "summary" | "description" | "theme" | "highlights" | "includes"
  | "goodToKnow" | "media" | "pricingMode" | "durationOptions" | "includedGuests" | "extraGuestCents" | "minGuests"
  | "maxGuests" | "minAge" | "locationArea" | "cancellationHours" | "leadTimeHours" | "maxAdvanceDays" | "isPlaceholder" | "airbnbUrl"
> & { addons: { id: string; name: string; description: string; priceCents: number; pricing: "per_booking" | "per_guest" }[] };

function toPublic(e: Experience, addonRows: (typeof addons.$inferSelect)[]): PublicExperience {
  return {
    id: e.id, slug: e.slug, name: e.name, shortName: e.shortName, tagline: e.tagline, summary: e.summary,
    description: e.description, theme: e.theme, highlights: e.highlights, includes: e.includes, goodToKnow: e.goodToKnow,
    media: e.media, pricingMode: e.pricingMode, durationOptions: e.durationOptions, includedGuests: e.includedGuests,
    extraGuestCents: e.extraGuestCents, minGuests: e.minGuests, maxGuests: e.maxGuests, minAge: e.minAge,
    locationArea: e.locationArea, cancellationHours: e.cancellationHours, leadTimeHours: e.leadTimeHours,
    maxAdvanceDays: e.maxAdvanceDays, isPlaceholder: e.isPlaceholder, airbnbUrl: e.airbnbUrl,
    addons: addonRows
      .filter((a) => a.active && (a.experienceId === null || a.experienceId === e.id))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((a) => ({ id: a.id, name: a.name, description: a.description, priceCents: a.priceCents, pricing: a.pricing })),
  };
}

export async function getActiveExperiences(): Promise<PublicExperience[]> {
  const db = await getDb();
  const [rows, addonRows] = await Promise.all([
    db.select().from(experiences).where(eq(experiences.active, true)).orderBy(asc(experiences.sortOrder)),
    db.select().from(addons).where(eq(addons.active, true)),
  ]);
  return rows.map((e) => toPublic(e, addonRows));
}

export async function getPublicExperience(slug: string): Promise<PublicExperience | null> {
  const all = await getActiveExperiences();
  return all.find((e) => e.slug === slug) ?? null;
}

export type PublicReview = {
  id: string; name: string; location: string | null; rating: number; body: string; source: string;
  experienceSlug: string | null; featured: boolean; hostReply: string | null; date: string | null;
  videoUrl: string | null;
};

export async function getPublishedReviews(opts: { experienceId?: string; limit?: number } = {}): Promise<PublicReview[]> {
  const db = await getDb();
  const rows = await db
    .select({ r: reviews, slug: experiences.slug })
    .from(reviews)
    .leftJoin(experiences, eq(reviews.experienceId, experiences.id))
    .where(and(eq(reviews.status, "published"), opts.experienceId ? eq(reviews.experienceId, opts.experienceId) : undefined))
    .orderBy(desc(reviews.featured), desc(reviews.createdAt))
    .limit(opts.limit ?? 200);
  return rows.map(({ r, slug }) => ({
    id: r.id, name: r.name, location: r.location, rating: r.rating, body: r.body, source: r.source,
    experienceSlug: slug, featured: r.featured, hostReply: r.hostReply, videoUrl: r.videoUrl,
    date: (r.reviewDate ?? r.createdAt)?.toISOString() ?? null,
  }));
}

/**
 * Headline rating. Combines the Airbnb aggregate (107 ratings at 4.98, which
 * we can't import individually) with reviews collected on this site.
 */
export async function getRatingSummary(): Promise<{ score: number; count: number }> {
  const db = await getDb();
  const [direct] = await db
    .select({ n: count(), avg: avg(reviews.rating) })
    .from(reviews)
    .where(and(eq(reviews.status, "published"), eq(reviews.source, "direct")));
  const n = Number(direct?.n ?? 0);
  const a = Number(direct?.avg ?? 0);
  const base = BUSINESS.airbnbRating;
  const total = base.count + n;
  const score = n ? (base.score * base.count + a * n) / total : base.score;
  return { score: Math.round(score * 100) / 100, count: total };
}

export type PublicEvent = {
  id: string; slug: string; title: string; summary: string; description: string; startAt: string; endAt: string;
  venue: string; address: string; imageUrl: string | null; meetupUrl: string | null; externalTicketUrl: string | null;
  rsvpEnabled: boolean; priceCents: number; capacity: number | null; spotsLeft: number | null; status: string;
};

export async function getUpcomingEvents(limit = 20): Promise<PublicEvent[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.status, "published"), gte(events.endAt, new Date())))
    .orderBy(asc(events.startAt))
    .limit(limit);
  return Promise.all(rows.map((e) => toPublicEvent(e)));
}

export async function getPublicEvent(slug: string): Promise<PublicEvent | null> {
  const db = await getDb();
  const [e] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
  if (!e || e.status === "draft") return null;
  return toPublicEvent(e);
}

async function toPublicEvent(e: typeof events.$inferSelect): Promise<PublicEvent> {
  let spotsLeft: number | null = null;
  if (e.capacity != null) {
    const db = await getDb();
    const going = await db
      .select({ guests: eventRsvps.guests })
      .from(eventRsvps)
      .where(and(eq(eventRsvps.eventId, e.id), eq(eventRsvps.status, "going")));
    spotsLeft = Math.max(0, e.capacity - going.reduce((s, r) => s + r.guests, 0));
  }
  return {
    id: e.id, slug: e.slug, title: e.title, summary: e.summary, description: e.description,
    startAt: e.startAt.toISOString(), endAt: e.endAt.toISOString(), venue: e.venue, address: e.address,
    imageUrl: e.imageUrl, meetupUrl: e.meetupUrl, externalTicketUrl: e.externalTicketUrl, rsvpEnabled: e.rsvpEnabled,
    priceCents: e.priceCents, capacity: e.capacity, spotsLeft, status: e.status,
  };
}
