import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/config";
import { getActiveExperiences, getUpcomingEvents } from "@/lib/queries/public";

// Reads live experiences and events, so build it per request (cached by the CDN headers Next sets).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [experiences, events] = await Promise.all([getActiveExperiences(), getUpcomingEvents(50)]);
  const now = new Date();
  const page = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "monthly") => ({
    url: siteUrl(path),
    lastModified: now,
    changeFrequency,
    priority,
  });
  return [
    page("/", 1, "weekly"),
    page("/experiences", 0.9, "weekly"),
    ...experiences.map((e) => page(`/experiences/${e.slug}`, 0.9, "weekly")),
    page("/book", 0.8, "weekly"),
    page("/gift-cards", 0.7),
    page("/groups", 0.7),
    page("/events", 0.7, "weekly"),
    ...events.map((ev) => ({ url: siteUrl(`/events/${ev.slug}`), lastModified: now, changeFrequency: "weekly" as const, priority: 0.5 })),
    page("/reviews", 0.6, "weekly"),
    page("/faq", 0.6),
    page("/about", 0.5),
    page("/contact", 0.4),
    page("/policies", 0.3, "yearly"),
  ];
}
