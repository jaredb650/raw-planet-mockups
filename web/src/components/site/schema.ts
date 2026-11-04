/** schema.org builders shared by pages. */
import { BUSINESS, siteUrl } from "@/lib/config";
import type { PublicEvent, PublicExperience, PublicReview } from "@/lib/queries/public";
import { fromPriceCents } from "./format";

export const ORG_ID = `${siteUrl("/")}#business`;

export function businessJsonLd(rating: { score: number; count: number }, image: string) {
  return {
    "@context": "https://schema.org",
    "@type": "EntertainmentBusiness",
    "@id": ORG_ID,
    name: BUSINESS.name,
    legalName: BUSINESS.legalName,
    url: siteUrl("/"),
    image: siteUrl(image),
    logo: siteUrl("/icon.svg"),
    email: BUSINESS.contactEmail,
    description:
      "Private music production, DJ and sound meditation sessions in New York City with producer Alex Gentil. No experience needed.",
    areaServed: { "@type": "City", name: "New York" },
    address: { "@type": "PostalAddress", addressLocality: "New York", addressRegion: "NY", addressCountry: "US" },
    knowsLanguage: ["en", "es"],
    founder: { "@type": "Person", name: "Alexander Gentil" },
    sameAs: [BUSINESS.instagram, BUSINESS.soundcloud, BUSINESS.facebook, BUSINESS.website],
    aggregateRating: { "@type": "AggregateRating", ratingValue: rating.score, reviewCount: rating.count, bestRating: 5 },
  };
}

export function reviewJsonLd(r: PublicReview) {
  return {
    "@type": "Review",
    author: { "@type": "Person", name: r.name },
    reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
    reviewBody: r.body,
    ...(r.date ? { datePublished: r.date.slice(0, 10) } : {}),
  };
}

export function experienceJsonLd(
  e: PublicExperience,
  opts: { images: string[]; rating: { score: number; count: number } | null; reviews: PublicReview[] },
) {
  const url = siteUrl(`/experiences/${e.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: e.name,
    description: e.summary || e.description,
    url,
    image: opts.images.map((i) => siteUrl(i)),
    brand: { "@type": "Brand", name: BUSINESS.name },
    category: "Experience",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: (fromPriceCents(e) / 100).toFixed(2),
      highPrice: (Math.max(...e.durationOptions.map((o) => o.priceCents)) / 100).toFixed(2),
      offerCount: e.durationOptions.length,
      availability: "https://schema.org/InStock",
      url: `${url}#book`,
      seller: { "@id": ORG_ID },
    },
    ...(opts.rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: opts.rating.score,
            reviewCount: opts.rating.count,
            bestRating: 5,
          },
        }
      : {}),
    ...(opts.reviews.length ? { review: opts.reviews.slice(0, 5).map(reviewJsonLd) } : {}),
  };
}

export function eventJsonLd(ev: PublicEvent, image: string) {
  const url = siteUrl(`/events/${ev.slug}`);
  const offerUrl = ev.meetupUrl || ev.externalTicketUrl || url;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: ev.title,
    description: ev.summary || ev.description,
    startDate: ev.startAt,
    endDate: ev.endAt,
    url,
    image: [siteUrl(image)],
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: ev.status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: ev.venue || BUSINESS.name,
      address: { "@type": "PostalAddress", streetAddress: ev.address || undefined, addressLocality: "New York", addressRegion: "NY", addressCountry: "US" },
    },
    organizer: { "@type": "Organization", "@id": ORG_ID, name: BUSINESS.name, url: siteUrl("/") },
    offers: {
      "@type": "Offer",
      price: (ev.priceCents / 100).toFixed(2),
      priceCurrency: "USD",
      url: offerUrl,
      availability: ev.spotsLeft === 0 ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      validFrom: ev.startAt,
    },
    ...(ev.capacity != null ? { maximumAttendeeCapacity: ev.capacity } : {}),
    ...(ev.spotsLeft != null ? { remainingAttendeeCapacity: ev.spotsLeft } : {}),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: siteUrl(it.path) })),
  };
}
