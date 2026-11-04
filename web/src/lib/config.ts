/**
 * Central configuration. Everything an operator might change lives in env
 * vars (secrets) or the admin Settings page (business copy); this file only
 * reads env and provides safe defaults so the app runs locally with no keys.
 */

export const BUSINESS = {
  name: "Raw Planet Experiences",
  shortName: "Raw Planet",
  legalName: "Raw Planet Media LLC",
  host: "Alex Gentil",
  timeZone: "America/New_York",
  city: "New York City",
  currency: "usd",
  contactEmail: process.env.CONTACT_EMAIL ?? "hello@rawplanetexperiences.com",
  instagram: "https://www.instagram.com/alexandergentil",
  soundcloud: "https://soundcloud.com/alexander-gentil",
  facebook: "https://www.facebook.com/Alexander.gentil",
  website: "https://www.alexandergentil.net",
  meetupGroupUrl: process.env.MEETUP_GROUP_URL ?? "",
  airbnbRating: { score: 4.98, count: 107 },
} as const;

export function siteUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3300").replace(/\/$/, "");
  return `${base}${path.startsWith("/") || path === "" ? path : `/${path}`}`;
}

/** Integration switches: each degrades to a local fallback when unset. */
export const integrations = {
  stripe: () => Boolean(process.env.STRIPE_SECRET_KEY),
  calcom: () => Boolean(process.env.CALCOM_API_KEY),
  resend: () => Boolean(process.env.RESEND_API_KEY),
  turnstile: () => Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
  /** Fake "pay" button when Stripe isn't set up. Never in production unless explicitly allowed (e.g. a demo deploy). */
  testCheckout: () => !process.env.STRIPE_SECRET_KEY && (process.env.NODE_ENV !== "production" || process.env.ALLOW_TEST_CHECKOUT === "1"),
};

/** Minutes a slot stays held while the guest is paying (Stripe minimum is 30). */
export const CHECKOUT_HOLD_MINUTES = 30;

/** Where operational alerts go (new booking, cancellations, inquiries). */
export function hostNotificationEmail(): string {
  return process.env.HOST_NOTIFICATION_EMAIL ?? BUSINESS.contactEmail;
}
