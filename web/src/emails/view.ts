/**
 * Pure builders that turn DB rows into pre-formatted template view models.
 * No DB access here, so the dev preview route and unit tests can use them
 * with fixture rows.
 */
import type { Booking, Experience } from "@/lib/db/schema";
import { siteUrl } from "@/lib/config";
import { reviewToken } from "@/lib/review-token";
import { waiverUrlFor } from "@/lib/waiver-token";
import { googleCalendarUrl } from "@/lib/ics";
import { localDateKey } from "@/lib/time";
import type { PriceLine } from "./components/ui";
import {
  experienceName,
  firstName,
  fmtDayAt,
  fmtDayShort,
  fmtDayYear,
  fmtDur,
  fmtGuests,
  fmtRange,
  langOf,
  money,
  type Lang,
} from "./i18n";
import type { BookingView } from "./types";

const PLACEHOLDER = /exact address|confirmed with your booking|sent with your confirmation|address (?:will be )?sent|\btb[ad]\b/i;

/** The full address only when Alex has entered a real one (placeholders and area-only strings → null). */
export function realAddress(address: string | null | undefined): string | null {
  const a = (address ?? "").trim();
  if (!a || PLACEHOLDER.test(a) || !/\d/.test(a)) return null;
  return a;
}

export function mapUrlFor(address: string | null): string | null {
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
}

/** Drop stock arrival copy that only makes sense before booking ("…are in your confirmation email"). */
function arrivalFor(text: string): string {
  return /confirmation email/i.test(text) ? "" : text.trim();
}

export function manageUrlFor(b: { code: string; manageToken: string }): string {
  return siteUrl(`/manage/${b.code}?t=${b.manageToken}`);
}

export type BookingViewInput = {
  booking: Booking;
  experience: Experience;
  addons?: { name: string; quantity: number; totalCents: number }[];
  promoCode?: string | null;
  hostPhone?: string | null;
  hostWhatsapp?: string | null;
  /** Force a language (e.g. the gift recipient's); default = booking language. */
  lang?: Lang;
  /**
   * "recipient" = the email goes to the person a booking was gifted to: their
   * name in the greeting, and NO manage link anywhere (it could cancel and
   * refund the purchaser's payment).
   */
  audience?: "purchaser" | "recipient";
  now?: Date;
};

export function buildBookingView(input: BookingViewInput): BookingView {
  const { booking: b, experience: e } = input;
  const lang = input.lang ?? langOf(b.language);
  const now = input.now ?? new Date();
  const name = experienceName(e, lang);
  const address = realAddress(e.address);
  const deadline = new Date(b.startAt.getTime() - e.cancellationHours * 3600_000);
  const recipient = input.audience === "recipient" && Boolean(b.giftRecipientName || b.giftRecipientEmail);
  const manage = recipient ? "" : manageUrlFor(b);
  const guestName = recipient && b.giftRecipientName ? b.giftRecipientName : b.contactName;
  const es = lang === "es";

  const priceLines: PriceLine[] = [];
  if (b.subtotalCents > 0) {
    priceLines.push({
      label: `${name} · ${fmtDur(b.durationMinutes, lang)}${e.pricingMode === "per_person" ? ` · ${fmtGuests(b.guests, lang)}` : ""}`,
      amount: money(b.subtotalCents),
    });
  }
  for (const a of input.addons ?? []) priceLines.push({ label: a.quantity > 1 ? `${a.name} × ${a.quantity}` : a.name, amount: money(a.totalCents) });
  if (b.discountCents > 0)
    priceLines.push({ label: input.promoCode ? `${es ? "Código" : "Code"} ${input.promoCode}` : es ? "Descuento" : "Discount", amount: `−${money(b.discountCents)}`, muted: true });
  if (b.giftCardCents > 0) priceLines.push({ label: es ? "Tarjeta de regalo" : "Gift card", amount: `−${money(b.giftCardCents)}`, muted: true });

  const summary = `${name} · Raw Planet`;
  const calDescription = [`${es ? "Reserva" : "Booking"} ${b.code}`, arrivalFor(e.arrivalInstructions), manage ? `${es ? "Gestionar" : "Manage"}: ${manage}` : null]
    .filter(Boolean)
    .join("\n\n");

  return {
    lang,
    id: b.id,
    code: b.code,
    theme: e.theme,
    slug: e.slug,
    experienceName: name,
    guestName,
    guestFirstName: firstName(guestName),
    guestEmail: recipient && b.giftRecipientEmail ? b.giftRecipientEmail : b.contactEmail,
    guestPhone: recipient ? null : b.contactPhone,
    dateLabel: fmtDayYear(b.startAt, lang),
    timeLabel: fmtRange(b.startAt, b.endAt, lang),
    dateShort: fmtDayShort(b.startAt, lang),
    dateKey: localDateKey(b.startAt),
    durationLabel: fmtDur(b.durationMinutes, lang),
    guests: b.guests,
    guestsLabel: fmtGuests(b.guests, lang),
    locationArea: e.locationArea,
    address,
    mapUrl: mapUrlFor(address),
    arrivalInstructions: arrivalFor(e.arrivalInstructions),
    includes: e.includes,
    goodToKnow: e.goodToKnow,
    priceLines,
    totalPaid: money(b.totalCents),
    paid: b.paymentStatus === "paid" || b.paymentStatus === "partially_refunded" || b.amountPaidCents > 0 || b.totalCents === 0,
    cancelDeadline: fmtDayAt(deadline, lang),
    cancelOpen: now < deadline,
    cancellationHours: e.cancellationHours,
    manageUrl: manage,
    bookUrl: siteUrl(`/book/${e.slug}`),
    reviewUrl: siteUrl(`/review/${b.code}?t=${reviewToken(b.id)}`),
    waiverUrl: e.waiverRequired && ["direct", "manual", "phone"].includes(b.source) ? waiverUrlFor(b) : null,
    googleCalendarUrl: googleCalendarUrl({
      start: b.startAt,
      end: b.endAt,
      summary,
      description: calDescription,
      location: address ?? e.locationArea,
    }),
    occasion: b.occasion,
    notes: b.customerNotes,
    isGift: b.isGift,
    giftRecipientName: b.giftRecipientName,
    giftRecipientEmail: b.giftRecipientEmail,
    giftMessage: b.giftMessage,
    hostPhone: input.hostPhone ?? null,
    hostWhatsapp: input.hostWhatsapp ?? null,
    deliverableUrl: b.deliverableUrl,
    deliverableReady: b.deliverableStatus === "delivered" && Boolean(b.deliverableUrl),
  };
}

/** Calendar invite fields for a booking (shared by email attachments). */
export function bookingIcsFields(v: BookingView, booking: Booking) {
  const es = v.lang === "es";
  return {
    uid: `${booking.id}@rawplanetexperiences.com`,
    start: booking.startAt,
    end: booking.endAt,
    summary: `${v.experienceName} · Raw Planet`,
    description: [`${es ? "Reserva" : "Booking"} ${v.code} · ${v.guestsLabel}`, v.arrivalInstructions, v.manageUrl ? `${es ? "Gestionar" : "Manage"}: ${v.manageUrl}` : null]
      .filter(Boolean)
      .join("\n\n"),
    location: v.address ?? v.locationArea,
    url: v.manageUrl || undefined,
  };
}
