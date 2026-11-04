/**
 * Raw Planet Experiences — database schema (Postgres via Drizzle).
 *
 * Money is always stored as integer cents (USD). Timestamps are timestamptz
 * (UTC instants); the business timezone (America/New_York) is applied only
 * when formatting or when interpreting a "local" date/time from a form.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()::text`);
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

/* ------------------------------------------------------------------ */
/* Experiences (what can be booked)                                    */
/* ------------------------------------------------------------------ */

export type PricingMode = "per_person" | "per_session";

/** One bookable length. `priceCents` is per guest (per_person) or for the whole session (per_session). */
export type DurationOption = {
  minutes: number;
  priceCents: number;
  label?: string;
};

/** Weekly opening hours in business-local time, e.g. { "1": [{ start: "10:00", end: "22:00" }] } (0 = Sunday). */
export type WeeklySchedule = Record<string, { start: string; end: string }[]>;

export type ExperienceMedia = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
};

export const experiences = pgTable("experiences", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  tagline: text("tagline").notNull().default(""),
  summary: text("summary").notNull().default(""),
  description: text("description").notNull().default(""),
  /** Brand colour token key: "production" | "dj" | "wellness" */
  theme: text("theme").notNull().default("production"),
  highlights: jsonb("highlights").$type<string[]>().notNull().default([]),
  includes: jsonb("includes").$type<string[]>().notNull().default([]),
  goodToKnow: jsonb("good_to_know").$type<string[]>().notNull().default([]),
  media: jsonb("media").$type<ExperienceMedia[]>().notNull().default([]),

  pricingMode: text("pricing_mode")
    .$type<PricingMode>()
    .notNull()
    .default("per_person"),
  durationOptions: jsonb("duration_options")
    .$type<DurationOption[]>()
    .notNull(),
  /** Session price covers up to this many guests (per_session mode only). */
  includedGuests: integer("included_guests").notNull().default(1),
  /** Charged per guest above includedGuests (per_session mode only). */
  extraGuestCents: integer("extra_guest_cents").notNull().default(0),
  minGuests: integer("min_guests").notNull().default(1),
  maxGuests: integer("max_guests").notNull().default(6),
  minAge: integer("min_age"),

  /** Experiences sharing a resource group cannot overlap (one host / one calendar). */
  resourceGroup: text("resource_group").notNull().default("alex"),
  schedule: jsonb("schedule").$type<WeeklySchedule>().notNull(),
  /** Start times are offered every N minutes inside the schedule window. */
  slotStepMinutes: integer("slot_step_minutes").notNull().default(120),
  bufferMinutes: integer("buffer_minutes").notNull().default(0),
  /** Minimum notice before a session can be booked. */
  leadTimeHours: integer("lead_time_hours").notNull().default(12),
  maxAdvanceDays: integer("max_advance_days").notNull().default(120),
  /** Free cancellation up to this many hours before start. */
  cancellationHours: integer("cancellation_hours").notNull().default(24),

  /** Public neighbourhood shown before booking; full address only after. */
  locationArea: text("location_area").notNull().default("New York, NY"),
  address: text("address").notNull().default(""),
  arrivalInstructions: text("arrival_instructions").notNull().default(""),

  calEventTypeId: integer("cal_event_type_id"),
  airbnbUrl: text("airbnb_url"),
  isPlaceholder: boolean("is_placeholder").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const addons = pgTable("addons", {
  id: id(),
  /** null = offered on every experience */
  experienceId: text("experience_id").references(() => experiences.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  priceCents: integer("price_cents").notNull(),
  pricing: text("pricing")
    .$type<"per_booking" | "per_guest">()
    .notNull()
    .default("per_booking"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Customers & bookings                                                */
/* ------------------------------------------------------------------ */

export const customers = pgTable(
  "customers",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    language: text("language").notNull().default("en"),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("customers_email_idx").on(t.email)],
);

export type BookingStatus =
  | "pending_payment" // slot held while customer is in Stripe Checkout
  | "confirmed"
  | "completed"
  | "cancelled"
  | "expired" // checkout abandoned / hold lapsed
  | "no_show";

export type PaymentStatus =
  "unpaid" | "paid" | "partially_refunded" | "refunded" | "not_required";

export type BookingSource =
  "direct" | "airbnb" | "viator" | "manual" | "cal" | "phone";

export type DeliverableStatus = "none" | "in_progress" | "delivered";

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    /** Human-friendly reference shown to customers, e.g. RP-7K3D9Q */
    code: text("code").notNull().unique(),
    experienceId: text("experience_id")
      .notNull()
      .references(() => experiences.id),
    customerId: text("customer_id").references(() => customers.id),
    status: text("status").$type<BookingStatus>().notNull(),
    paymentStatus: text("payment_status")
      .$type<PaymentStatus>()
      .notNull()
      .default("unpaid"),
    source: text("source").$type<BookingSource>().notNull().default("direct"),

    startAt: ts("start_at").notNull(),
    endAt: ts("end_at").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    guests: integer("guests").notNull(),
    resourceGroup: text("resource_group").notNull(),

    // Snapshot of contact details at booking time (customer row may change later)
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone"),
    language: text("language").notNull().default("en"),
    customerNotes: text("customer_notes").notNull().default(""),
    internalNotes: text("internal_notes").notNull().default(""),
    occasion: text("occasion"),

    // Money (cents)
    currency: text("currency").notNull().default("usd"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    addonsCents: integer("addons_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    giftCardCents: integer("gift_card_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    amountPaidCents: integer("amount_paid_cents").notNull().default(0),
    amountRefundedCents: integer("amount_refunded_cents").notNull().default(0),
    promoCodeId: text("promo_code_id"),
    giftCardId: text("gift_card_id"),

    // Gift bookings (buyer pays, someone else attends)
    isGift: boolean("is_gift").notNull().default(false),
    giftRecipientName: text("gift_recipient_name"),
    giftRecipientEmail: text("gift_recipient_email"),
    giftMessage: text("gift_message"),

    // Integrations
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    calBookingUid: text("cal_booking_uid"),
    calReservationUid: text("cal_reservation_uid"),
    externalRef: text("external_ref"), // e.g. Airbnb confirmation code

    holdExpiresAt: ts("hold_expires_at"),
    /** Secret for the customer's self-serve manage link. */
    manageToken: text("manage_token").notNull(),

    // After-session deliverable (the track / mix the guest takes home)
    deliverableStatus: text("deliverable_status")
      .$type<DeliverableStatus>()
      .notNull()
      .default("none"),
    deliverableUrl: text("deliverable_url"),

    // Automation bookkeeping
    confirmationSentAt: ts("confirmation_sent_at"),
    reminderSentAt: ts("reminder_sent_at"),
    followupSentAt: ts("followup_sent_at"),
    reviewRequestSentAt: ts("review_request_sent_at"),
    abandonedEmailSentAt: ts("abandoned_email_sent_at"),

    rescheduledFromId: text("rescheduled_from_id"),
    rescheduleCount: integer("reschedule_count").notNull().default(0),
    confirmedAt: ts("confirmed_at"),
    cancelledAt: ts("cancelled_at"),
    cancelReason: text("cancel_reason"),
    cancelledBy: text("cancelled_by").$type<"customer" | "admin" | "system">(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("bookings_start_idx").on(t.startAt),
    index("bookings_status_idx").on(t.status),
    index("bookings_customer_idx").on(t.customerId),
    index("bookings_email_idx").on(t.contactEmail),
    index("bookings_stripe_session_idx").on(t.stripeCheckoutSessionId),
    index("bookings_cal_uid_idx").on(t.calBookingUid),
  ],
);

export const bookingAddons = pgTable(
  "booking_addons",
  {
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    addonId: text("addon_id").notNull(),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitCents: integer("unit_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
  },
  (t) => [primaryKey({ columns: [t.bookingId, t.addonId] })],
);

/** Order timeline — powers the admin activity feed and customer "order tracking". */
export const bookingEvents = pgTable(
  "booking_events",
  {
    id: id(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // created | paid | confirmed | email_sent | rescheduled | cancelled | refunded | note | deliverable | reminder ...
    message: text("message").notNull(),
    /** Visible to the customer on their manage page? */
    public: boolean("public").notNull().default(false),
    actor: text("actor")
      .$type<"system" | "admin" | "customer">()
      .notNull()
      .default("system"),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("booking_events_booking_idx").on(t.bookingId)],
);

export const refunds = pgTable("refunds", {
  id: id(),
  bookingId: text("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  reason: text("reason").notNull().default(""),
  stripeRefundId: text("stripe_refund_id"),
  /** Part of the refund returned to a gift card balance instead of the card. */
  giftCardCents: integer("gift_card_cents").notNull().default(0),
  createdBy: text("created_by")
    .$type<"customer" | "admin" | "system">()
    .notNull()
    .default("system"),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Availability: manual blocks + imported calendar feeds                */
/* ------------------------------------------------------------------ */

export const calendarFeeds = pgTable("calendar_feeds", {
  id: id(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  /** Which resource group the busy times block. */
  resourceGroup: text("resource_group").notNull().default("alex"),
  active: boolean("active").notNull().default(true),
  lastSyncedAt: ts("last_synced_at"),
  lastError: text("last_error"),
  createdAt: createdAt(),
});

export const blocks = pgTable(
  "blocks",
  {
    id: id(),
    startAt: ts("start_at").notNull(),
    endAt: ts("end_at").notNull(),
    resourceGroup: text("resource_group").notNull().default("alex"),
    /** Optionally restrict the block to a single experience. */
    experienceId: text("experience_id").references(() => experiences.id, {
      onDelete: "cascade",
    }),
    reason: text("reason").notNull().default(""),
    source: text("source")
      .$type<"manual" | "ical" | "viator" | "airbnb">()
      .notNull()
      .default("manual"),
    feedId: text("feed_id").references(() => calendarFeeds.id, {
      onDelete: "cascade",
    }),
    externalUid: text("external_uid"),
    createdAt: createdAt(),
  },
  (t) => [index("blocks_range_idx").on(t.startAt, t.endAt)],
);

/* ------------------------------------------------------------------ */
/* Promotions & gift cards                                              */
/* ------------------------------------------------------------------ */

export const promoCodes = pgTable("promo_codes", {
  id: id(),
  code: text("code").notNull().unique(), // stored upper-case
  description: text("description").notNull().default(""),
  kind: text("kind").$type<"percent" | "fixed">().notNull(),
  /** percent: 1–100; fixed: cents */
  value: integer("value").notNull(),
  experienceIds: jsonb("experience_ids").$type<string[] | null>(),
  minSubtotalCents: integer("min_subtotal_cents").notNull().default(0),
  maxRedemptions: integer("max_redemptions"),
  redemptions: integer("redemptions").notNull().default(0),
  validFrom: ts("valid_from"),
  validUntil: ts("valid_until"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export type GiftCardStatus = "pending_payment" | "active" | "depleted" | "void";

export const giftCards = pgTable("gift_cards", {
  id: id(),
  code: text("code").notNull().unique(),
  initialCents: integer("initial_cents").notNull(),
  balanceCents: integer("balance_cents").notNull(),
  status: text("status")
    .$type<GiftCardStatus>()
    .notNull()
    .default("pending_payment"),
  purchaserName: text("purchaser_name").notNull(),
  purchaserEmail: text("purchaser_email").notNull(),
  recipientName: text("recipient_name"),
  recipientEmail: text("recipient_email"),
  message: text("message"),
  /** Send the card to the recipient on this date (null = immediately). */
  deliverAt: ts("deliver_at"),
  deliveredAt: ts("delivered_at"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  /** Issued by admin (comp / promo) rather than purchased. */
  issuedByAdmin: boolean("issued_by_admin").notNull().default(false),
  language: text("language").notNull().default("en"),
  createdAt: createdAt(),
});

export const giftCardTransactions = pgTable("gift_card_transactions", {
  id: id(),
  giftCardId: text("gift_card_id")
    .notNull()
    .references(() => giftCards.id, { onDelete: "cascade" }),
  bookingId: text("booking_id"),
  /** negative = spent, positive = loaded / refunded back */
  amountCents: integer("amount_cents").notNull(),
  note: text("note").notNull().default(""),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Reviews                                                              */
/* ------------------------------------------------------------------ */

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    bookingId: text("booking_id").references(() => bookings.id, {
      onDelete: "set null",
    }),
    experienceId: text("experience_id").references(() => experiences.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    location: text("location"),
    rating: integer("rating").notNull(),
    body: text("body").notNull(),
    source: text("source")
      .$type<"airbnb" | "direct" | "google" | "viator">()
      .notNull()
      .default("direct"),
    status: text("status")
      .$type<"pending" | "published" | "hidden">()
      .notNull()
      .default("pending"),
    featured: boolean("featured").notNull().default(false),
    hostReply: text("host_reply"),
    /** Video testimonial: a public URL (YouTube/Vimeo/Instagram) or a /media path. */
    videoUrl: text("video_url"),
    reviewDate: ts("review_date"),
    createdAt: createdAt(),
  },
  // One review per booking; imported reviews have no booking (NULLs don't collide).
  (t) => [uniqueIndex("reviews_booking_idx").on(t.bookingId)],
);

/* ------------------------------------------------------------------ */
/* Community events & meetups                                           */
/* ------------------------------------------------------------------ */

export const events = pgTable("events", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  description: text("description").notNull().default(""),
  startAt: ts("start_at").notNull(),
  endAt: ts("end_at").notNull(),
  venue: text("venue").notNull().default(""),
  address: text("address").notNull().default(""),
  imageUrl: text("image_url"),
  /** Link to the Meetup event / group page for discovery + RSVP there. */
  meetupUrl: text("meetup_url"),
  externalTicketUrl: text("external_ticket_url"),
  /** On-site RSVP (free) when enabled; paid events use Stripe. */
  rsvpEnabled: boolean("rsvp_enabled").notNull().default(true),
  priceCents: integer("price_cents").notNull().default(0),
  capacity: integer("capacity"),
  /** Groups recurring occurrences (e.g. the biweekly meetup series). */
  seriesId: text("series_id"),
  status: text("status")
    .$type<"draft" | "published" | "cancelled">()
    .notNull()
    .default("published"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const eventRsvps = pgTable(
  "event_rsvps",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    guests: integer("guests").notNull().default(1),
    status: text("status")
      .$type<"going" | "cancelled" | "pending_payment">()
      .notNull()
      .default("going"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    language: text("language").notNull().default("en"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("event_rsvps_event_email_idx").on(t.eventId, t.email)],
);

/* ------------------------------------------------------------------ */
/* Inquiries, waitlist, email log, settings, webhook idempotency        */
/* ------------------------------------------------------------------ */

export const inquiries = pgTable("inquiries", {
  id: id(),
  kind: text("kind")
    .$type<"group" | "private_event" | "corporate" | "general" | "press">()
    .notNull()
    .default("general"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  experienceId: text("experience_id"),
  preferredDate: text("preferred_date"),
  groupSize: integer("group_size"),
  message: text("message").notNull().default(""),
  status: text("status")
    .$type<"new" | "replied" | "converted" | "closed">()
    .notNull()
    .default("new"),
  language: text("language").notNull().default("en"),
  createdAt: createdAt(),
});

export const waitlist = pgTable("waitlist", {
  id: id(),
  experienceId: text("experience_id")
    .notNull()
    .references(() => experiences.id, { onDelete: "cascade" }),
  /** Business-local date YYYY-MM-DD they want */
  date: text("date").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  guests: integer("guests").notNull().default(1),
  notifiedAt: ts("notified_at"),
  language: text("language").notNull().default("en"),
  createdAt: createdAt(),
});

export const emailLog = pgTable(
  "email_log",
  {
    id: id(),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    template: text("template").notNull(),
    bookingId: text("booking_id"),
    status: text("status").$type<"sent" | "failed" | "logged">().notNull(),
    providerId: text("provider_id"),
    error: text("error"),
    /** Rendered HTML (kept so the admin can preview what was sent). */
    html: text("html"),
    createdAt: createdAt(),
  },
  (t) => [index("email_log_booking_idx").on(t.bookingId)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(), // provider event id
  provider: text("provider").notNull(),
  type: text("type").notNull(),
  processedAt: ts("processed_at").notNull().defaultNow(),
});

/* Inferred row types */
export type Experience = typeof experiences.$inferSelect;
export type Addon = typeof addons.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type BookingEvent = typeof bookingEvents.$inferSelect;
export type Block = typeof blocks.$inferSelect;
export type CalendarFeed = typeof calendarFeeds.$inferSelect;
export type PromoCode = typeof promoCodes.$inferSelect;
export type GiftCard = typeof giftCards.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type CommunityEvent = typeof events.$inferSelect;
export type EventRsvp = typeof eventRsvps.$inferSelect;
export type Inquiry = typeof inquiries.$inferSelect;
export type WaitlistEntry = typeof waitlist.$inferSelect;
export type EmailLogEntry = typeof emailLog.$inferSelect;
