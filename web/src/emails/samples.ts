/**
 * Fixture data + registry for the dev preview route (/api/dev/emails/<template>).
 * Every template is reachable here in EN and ES so it can be eyeballed.
 */
import type { Booking, Experience } from "@/lib/db/schema";
import { siteUrl } from "@/lib/config";
import { googleCalendarUrl } from "@/lib/ics";
import { fmtDay, fmtDayShort, fmtDayYear, fmtRange, fmtGuests, type Lang } from "./i18n";
import { buildBookingView } from "./view";
import type { EmailOutput } from "./types";
import {
  abandonedCheckoutEmail,
  bookingCancelledEmail,
  bookingConfirmationEmail,
  bookingReminderEmail,
  bookingRescheduledEmail,
  deliverableReadyEmail,
  followupEmail,
  giftBookingRecipientEmail,
  reviewNudgeEmail,
  slotConflictRefundEmail,
} from "./templates/booking";
import { giftCardReceiptEmail, giftCardRecipientEmail, type GiftCardView } from "./templates/giftcards";
import { inquiryAutoReplyEmail, inquiryHostAlertEmail, type InquiryView } from "./templates/inquiry";
import { eventRsvpEmail, manageLinksEmail, waitlistOpeningEmail } from "./templates/misc";
import { hostBookingAlertEmail, hostDigestEmail, type HostBookingView } from "./templates/host";

const D = (iso: string) => new Date(iso);
// Fixed sample: Saturday Nov 14, 2026, 2pm–4pm New York; "now" = Nov 4.
const NOW = D("2026-11-04T15:00:00Z");

function experience(theme: string): Experience {
  const base = {
    id: `exp-${theme}`,
    tagline: "",
    summary: "",
    description: "",
    highlights: [],
    media: [],
    includedGuests: 1,
    extraGuestCents: 0,
    minAge: null,
    resourceGroup: "alex",
    schedule: {},
    slotStepMinutes: 120,
    bufferMinutes: 0,
    leadTimeHours: 12,
    maxAdvanceDays: 120,
    calEventTypeId: null,
    airbnbUrl: null,
    isPlaceholder: false,
    active: true,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
  if (theme === "dj")
    return {
      ...base,
      slug: "dj-session",
      name: "DJ Session",
      shortName: "DJ session",
      theme: "dj",
      includes: ["All DJ gear and headphones", "A private session with Alex", "Music library — or bring your own playlist"],
      goodToKnow: ["Sessions in English or Spanish", "Great for birthdays and groups of friends"],
      pricingMode: "per_session",
      durationOptions: [{ minutes: 120, priceCents: 30000 }],
      minGuests: 1,
      maxGuests: 4,
      cancellationHours: 24,
      locationArea: "Manhattan, NYC",
      // A real-looking address, so the preview shows the map link variant.
      address: "123 Sample St, Studio 4, New York, NY 10009",
      arrivalInstructions: "Press the buzzer when you arrive and Alex will bring you upstairs.",
    };
  if (theme === "wellness")
    return {
      ...base,
      slug: "sound-meditation",
      name: "Sound Meditation",
      shortName: "Sound meditation",
      theme: "wellness",
      includes: ["Mats and cushions", "Live sound by Alex", "Tea and a slow return to the city"],
      goodToKnow: ["Group bookings only — minimum 10 guests", "Wear comfortable clothes"],
      pricingMode: "per_person",
      durationOptions: [{ minutes: 90, priceCents: 6000 }],
      minGuests: 10,
      maxGuests: 30,
      cancellationHours: 72,
      locationArea: "New York, NY",
      address: "Venue confirmed with your booking",
      arrivalInstructions: "Arrive 10 minutes early to settle in.",
    };
  return {
    ...base,
    slug: "music-production",
    name: "Music Production Session",
    shortName: "Music production",
    theme: "production",
    includes: ["All studio gear and software", "A private session with Alex", "Your finished track, sent after your visit"],
    goodToKnow: ["Ages 10 and up", "Press the buzzer and Alex will bring you upstairs", "Sessions in English or Spanish"],
    pricingMode: "per_person",
    durationOptions: [{ minutes: 120, priceCents: 15000 }],
    minGuests: 1,
    maxGuests: 6,
    cancellationHours: 24,
    locationArea: "East Village, NYC 10009",
    address: "East Village, New York, NY 10009 (exact address sent with your confirmation)",
    arrivalInstructions: "Press the buzzer when you arrive and Alex will bring you upstairs.",
  };
}

function booking(e: Experience, lang: Lang, over: Partial<Booking> = {}): Booking {
  const guests = e.theme === "wellness" ? 12 : 2;
  const subtotal = e.pricingMode === "per_person" ? e.durationOptions[0].priceCents * guests : e.durationOptions[0].priceCents;
  const discount = Math.round(subtotal * 0.1);
  return {
    id: "00000000-sample-booking",
    code: "RP-7K3D9Q",
    experienceId: e.id,
    customerId: null,
    status: "confirmed",
    paymentStatus: "paid",
    source: "direct",
    startAt: D("2026-11-14T19:00:00Z"),
    endAt: new Date(D("2026-11-14T19:00:00Z").getTime() + e.durationOptions[0].minutes * 60_000),
    durationMinutes: e.durationOptions[0].minutes,
    guests,
    resourceGroup: "alex",
    contactName: lang === "es" ? "Lucía Fernández" : "Maya Thompson",
    contactEmail: "guest@example.com",
    contactPhone: "+1 (917) 555-0142",
    language: lang,
    customerNotes: lang === "es" ? "Es el cumpleaños de mi hermana, ¡le encanta el reggaetón!" : "It's my sister's birthday. She loves 90s R&B!",
    internalNotes: "",
    occasion: lang === "es" ? "Cumpleaños" : "Birthday",
    currency: "usd",
    subtotalCents: subtotal,
    addonsCents: 0,
    discountCents: discount,
    giftCardCents: 0,
    totalCents: subtotal - discount,
    amountPaidCents: subtotal - discount,
    amountRefundedCents: 0,
    promoCodeId: null,
    giftCardId: null,
    isGift: false,
    giftRecipientName: null,
    giftRecipientEmail: null,
    giftMessage: null,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    calBookingUid: null,
    calReservationUid: null,
    externalRef: null,
    holdExpiresAt: null,
    manageToken: "sampletoken",
    deliverableStatus: "none",
    deliverableUrl: null,
    confirmationSentAt: null,
    reminderSentAt: null,
    followupSentAt: null,
    reviewRequestSentAt: null,
    abandonedEmailSentAt: null,
    rescheduledFromId: null,
    rescheduleCount: 0,
    confirmedAt: NOW,
    cancelledAt: null,
    cancelReason: null,
    cancelledBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

type Opts = { lang: Lang; theme: string };

function view(o: Opts, over: Partial<Booking> = {}, now = NOW) {
  const e = experience(o.theme);
  return buildBookingView({
    booking: booking(e, o.lang, over),
    experience: e,
    promoCode: "WELCOME10",
    hostPhone: "+1 (646) 555-0199",
    hostWhatsapp: "+1 646 555 0199",
    now,
  });
}

function giftCard(o: Opts, over: Partial<GiftCardView> = {}): GiftCardView {
  return {
    lang: o.lang,
    code: "RAW-7KQ3-M9XD-2PHT",
    amount: "$300",
    purchaserName: o.lang === "es" ? "Daniela Ortiz" : "Jordan Lee",
    recipientName: o.lang === "es" ? "Mateo" : "Sam Rivera",
    recipientEmail: "friend@example.com",
    message: o.lang === "es" ? "¡Feliz cumpleaños! Ya era hora de que grabaras esa canción." : "Happy birthday! Time to finally make that song you keep humming.",
    scheduledLabel: null,
    issuedByAdmin: false,
    bookUrl: siteUrl("/book"),
    giftCardsUrl: siteUrl("/gift-cards"),
    ...over,
  };
}

function inquiry(o: Opts): InquiryView {
  return {
    lang: o.lang,
    id: "inq-1",
    kind: "corporate",
    name: o.lang === "es" ? "Ana Ruiz" : "Ana Ruiz",
    email: "ana@example.com",
    phone: "+1 (212) 555-0110",
    experienceName: o.lang === "es" ? "Meditación con sonido" : "Sound Meditation",
    theme: "wellness",
    preferredDate: fmtDayYear(D("2026-11-24T17:00:00Z"), o.lang),
    groupSize: 14,
    message:
      o.lang === "es"
        ? "Offsite de nuestro equipo de diseño. ¿Podríamos hacer la meditación con sonido y luego tomar algo?"
        : "Team offsite for our design team. Could we do the sound meditation followed by drinks?",
    receivedLabel: "Wed, Nov 4 at 10:12am",
    adminUrl: siteUrl("/admin/inquiries"),
    faqUrl: siteUrl("/faq"),
    bookUrl: siteUrl("/book"),
  };
}

function hostView(kind: HostBookingView["kind"], o: Opts): HostBookingView {
  const v = view({ ...o, lang: "en" });
  return {
    kind,
    id: v.id,
    code: v.code,
    theme: v.theme,
    experienceName: v.experienceName,
    dateLabel: "Sat, Nov 14, 2026",
    timeLabel: v.timeLabel,
    durationLabel: v.durationLabel,
    guests: v.guests,
    contactName: v.guestName,
    contactEmail: v.guestEmail,
    contactPhone: v.guestPhone,
    language: o.lang,
    sourceLabel: "Website",
    total: v.totalPaid,
    paid: v.totalPaid,
    addons: [],
    promo: "WELCOME10 (−$30)",
    giftCardUsed: null,
    occasion: v.occasion,
    notes: v.notes,
    isGift: false,
    giftRecipientName: null,
    previousLabel: kind === "rescheduled" ? "Fri, Nov 13, 6pm – 8pm" : null,
    cancelReason: kind === "cancelled" ? "Flight changed" : null,
    cancelledBy: kind === "cancelled" ? "guest" : null,
    refundLabel: kind === "cancelled" ? "$270 to card" : null,
    warnings: [],
    adminUrl: siteUrl(`/admin/bookings/${v.id}`),
    hoursUntil: 220,
  };
}

export const TEMPLATES: Record<string, { label: string; render: (o: Opts) => EmailOutput }> = {
  booking_confirmation: { label: "Booking confirmation", render: (o) => bookingConfirmationEmail(view(o)) },
  booking_confirmation_gift: {
    label: "Booking confirmation (gift booking, purchaser)",
    render: (o) =>
      bookingConfirmationEmail(view(o, { isGift: true, giftRecipientName: "Sam Rivera", giftRecipientEmail: "sam@example.com", giftMessage: "Happy birthday!" })),
  },
  gift_booking_recipient: {
    label: "Gift booking (recipient)",
    render: (o) =>
      giftBookingRecipientEmail({
        ...view(o, {
          isGift: true,
          giftRecipientName: o.lang === "es" ? "Mateo Ruiz" : "Sam Rivera",
          giftRecipientEmail: "sam@example.com",
          giftMessage: o.lang === "es" ? "¡Feliz cumpleaños! Te va a encantar." : "Happy birthday! You're going to love this.",
        }),
        purchaserName: o.lang === "es" ? "Lucía Fernández" : "Maya Thompson",
      }),
  },
  booking_rescheduled: {
    label: "Booking rescheduled",
    render: (o) => bookingRescheduledEmail({ ...view(o), previousLabel: `${fmtDay(D("2026-11-13T23:00:00Z"), o.lang)}, ${fmtRange(D("2026-11-13T23:00:00Z"), D("2026-11-14T01:00:00Z"), o.lang)}` }),
  },
  booking_cancelled: {
    label: "Booking cancelled (refunded)",
    render: (o) => bookingCancelledEmail({ ...view(o, { status: "cancelled" }), cardRefund: "$270", giftRefund: null, paidSomething: true }),
  },
  booking_cancelled_late: {
    label: "Booking cancelled (late, no refund)",
    render: (o) => bookingCancelledEmail({ ...view(o, { status: "cancelled" }), cardRefund: null, giftRefund: null, paidSomething: true }),
  },
  booking_reminder: {
    label: "Reminder (day before)",
    render: (o) => bookingReminderEmail({ ...view(o, {}, D("2026-11-13T15:00:00Z")), dayWord: o.lang === "es" ? "mañana" : "tomorrow" }),
  },
  followup_review: { label: "Follow-up + review request", render: (o) => followupEmail(view(o, { status: "completed" })) },
  review_nudge: { label: "Review nudge (one reminder)", render: (o) => reviewNudgeEmail(view(o, { status: "completed" })) },
  deliverable_ready: {
    label: "Track ready",
    render: (o) =>
      deliverableReadyEmail({
        ...view(o, { status: "completed", deliverableStatus: "delivered", deliverableUrl: "https://example.com/your-track.wav" }),
        hasReview: false,
      }),
  },
  slot_conflict_refund: {
    label: "Slot conflict, refunded",
    render: (o) => slotConflictRefundEmail({ ...view(o, { status: "cancelled" }), refund: "$270" }),
  },
  abandoned_checkout: { label: "Abandoned checkout", render: (o) => abandonedCheckoutEmail(view(o, { status: "expired", paymentStatus: "unpaid" })) },
  gift_card_receipt: { label: "Gift card receipt (sent to recipient now)", render: (o) => giftCardReceiptEmail(giftCard(o)) },
  gift_card_receipt_scheduled: {
    label: "Gift card receipt (scheduled delivery)",
    render: (o) => giftCardReceiptEmail(giftCard(o, { scheduledLabel: fmtDay(D("2026-12-25T14:00:00Z"), o.lang) })),
  },
  gift_card_receipt_self: {
    label: "Gift card receipt (no recipient email: purchaser gets the card)",
    render: (o) => giftCardReceiptEmail(giftCard(o, { recipientEmail: null, recipientName: null, message: null })),
  },
  gift_card_recipient: { label: "Gift card (recipient)", render: (o) => giftCardRecipientEmail(giftCard(o)) },
  inquiry_reply: { label: "Inquiry auto-reply", render: (o) => inquiryAutoReplyEmail(inquiry(o)) },
  inquiry_host: { label: "Inquiry host alert", render: (o) => inquiryHostAlertEmail(inquiry(o)) },
  waitlist_opening: {
    label: "Waitlist: spot opened",
    render: (o) =>
      waitlistOpeningEmail({
        lang: o.lang,
        name: o.lang === "es" ? "Lucía" : "Maya",
        theme: o.theme,
        experienceName: view(o).experienceName,
        dateLabel: fmtDay(D("2026-11-14T19:00:00Z"), o.lang),
        guestsLabel: fmtGuests(2, o.lang),
        bookUrl: siteUrl("/book/music-production?date=2026-11-14"),
      }),
  },
  event_rsvp: {
    label: "Community event RSVP",
    render: (o) => {
      const start = D("2026-11-19T23:30:00Z");
      const end = D("2026-11-20T01:30:00Z");
      return eventRsvpEmail({
        lang: o.lang,
        name: o.lang === "es" ? "Lucía" : "Maya",
        title: o.lang === "es" ? "Encuentro de productores · Raw Planet" : "Producers' Meetup · Raw Planet",
        summary: "",
        dateLabel: fmtDayYear(start, o.lang),
        timeLabel: fmtRange(start, end, o.lang),
        venue: "Raw Planet Studio",
        address: "East Village, New York, NY",
        mapUrl: null,
        guests: 2,
        guestsLabel: fmtGuests(2, o.lang),
        eventUrl: siteUrl("/events/producers-meetup"),
        meetupUrl: "https://www.meetup.com/",
        googleCalendarUrl: googleCalendarUrl({ start, end, summary: "Producers' Meetup" }),
        cancelled: false,
      });
    },
  },
  manage_links: {
    label: "Manage links (find my booking)",
    render: (o) => {
      const v = view(o);
      const w = view({ ...o, theme: "dj" });
      return manageLinksEmail({
        lang: o.lang,
        name: v.guestName,
        upcoming: [
          { code: v.code, experienceName: v.experienceName, dateLabel: fmtDayShort(D("2026-11-14T19:00:00Z"), o.lang), timeLabel: v.timeLabel, manageUrl: v.manageUrl, theme: v.theme },
          { code: "RP-M4XT8B", experienceName: w.experienceName, dateLabel: fmtDayShort(D("2026-12-05T20:00:00Z"), o.lang), timeLabel: fmtRange(D("2026-12-05T20:00:00Z"), D("2026-12-05T22:00:00Z"), o.lang), manageUrl: w.manageUrl, theme: "dj" },
        ],
        past: [],
        bookUrl: siteUrl("/book"),
      });
    },
  },
  host_new: { label: "Host: new booking", render: (o) => hostBookingAlertEmail(hostView("new", o)) },
  host_cancelled: { label: "Host: cancelled", render: (o) => hostBookingAlertEmail(hostView("cancelled", o)) },
  host_rescheduled: { label: "Host: rescheduled", render: (o) => hostBookingAlertEmail(hostView("rescheduled", o)) },
  host_digest: {
    label: "Host: morning digest",
    render: () =>
      hostDigestEmail({
        dateLabel: "Saturday, November 14",
        tomorrowLabel: "Tomorrow, Sunday",
        today: [
          { id: "1", time: "11am", experienceName: "DJ Session", theme: "dj", contactName: "Chris Park", guests: 3, sourceLabel: "Airbnb", phone: null, notes: null, flags: [], adminUrl: siteUrl("/admin") },
          { id: "2", time: "2pm", experienceName: "Music Production", theme: "production", contactName: "Maya Thompson", guests: 2, sourceLabel: "Website", phone: "+1 (917) 555-0142", notes: "It's my sister's birthday. She loves 90s R&B!", flags: ["Birthday", "First visit"], adminUrl: siteUrl("/admin") },
          { id: "3", time: "6:30pm", experienceName: "Music Production", theme: "production", contactName: "Lucía Fernández", guests: 4, sourceLabel: "Website", phone: "+1 (646) 555-0177", notes: null, flags: ["Español", "Returning guest"], adminUrl: siteUrl("/admin") },
        ],
        tomorrow: [
          { id: "4", time: "10am", experienceName: "Sound Meditation", theme: "wellness", contactName: "Ana Ruiz (Acme)", guests: 14, sourceLabel: "Manual", phone: null, notes: null, flags: ["Unpaid"], adminUrl: siteUrl("/admin") },
        ],
        stats: [
          { label: "Booked yesterday", value: "3" },
          { label: "This month", value: "$4,820" },
          { label: "Next 7 days", value: "9" },
        ],
        attention: [
          { text: "2 new inquiries waiting for a reply", url: siteUrl("/admin/inquiries") },
          { text: "Track for RP-7K3D9Q not delivered yet (5 days)", url: siteUrl("/admin/bookings") },
        ],
        adminUrl: siteUrl("/admin"),
        calendarUrl: siteUrl("/admin/calendar"),
      }),
  },
};
