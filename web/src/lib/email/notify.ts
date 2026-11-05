/**
 * Transactional email entry points. The booking service, admin actions and
 * cron jobs call ONLY these functions; templates live in src/emails/.
 *
 * NOTE: this is the stable interface. Every exported `send*` function keeps
 * its original signature and never throws; failures are recorded in
 * email_log (by send.ts) and the console. Jobs that must know whether a send
 * worked (to retry) use the `try*` variants, which return a SendStatus.
 *
 * Guest-facing rules:
 * - Language: booking.language ("es" → Spanish); for non-booking emails, the
 *   customer's saved language for that address, else English.
 * - Addresses ending in ".invalid" (Airbnb/Viator relay placeholders) are skipped.
 * - The same template + recipient + booking + subject is not sent twice within
 *   2 minutes (protects against double webhooks / double clicks).
 * - Gift bookings: the purchaser owns the booking (manage link); the
 *   recipient gets their own emails without it.
 */
import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  bookingAddons,
  bookingEvents,
  bookings,
  calendarFeeds,
  customers,
  emailLog,
  eventRsvps,
  events,
  experiences,
  giftCards,
  inquiries,
  promoCodes,
  refunds,
  reviews,
  waitlist,
  type Booking,
  type Experience,
} from "@/lib/db/schema";
import { BUSINESS, hostNotificationEmail, siteUrl } from "@/lib/config";
import { buildIcs, googleCalendarUrl, type IcsEvent } from "@/lib/ics";
import { addDaysKey, fmt, fromLocal, localDateKey } from "@/lib/time";
import { getStringSetting } from "@/lib/automation/settings";
import { renderEmail } from "@/emails/render";
import { buildBookingView, bookingIcsFields, manageUrlFor, mapUrlFor, realAddress } from "@/emails/view";
import { experienceName, fmtClock, fmtDay, fmtDayShort, fmtDayYear, fmtDur, fmtGuests, fmtRange, langOf, money, type Lang } from "@/emails/i18n";
import type { BookingView, EmailOutput } from "@/emails/types";
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
} from "@/emails/templates/booking";
import { giftCardReceiptEmail, giftCardRecipientEmail, type GiftCardView } from "@/emails/templates/giftcards";
import { inquiryAutoReplyEmail, inquiryHostAlertEmail, type InquiryKind } from "@/emails/templates/inquiry";
import { eventRsvpEmail, manageLinksEmail, waitlistOpeningEmail, type ManageLinkItem } from "@/emails/templates/misc";
import { hostBookingAlertEmail, hostDigestEmail, hostWeeklyReportEmail, type DigestSession, type HostBookingView } from "@/emails/templates/host";
import { getCashEntries, weekStartKey } from "@/lib/admin/dashboard";
import { getReport, sumCash } from "@/lib/admin/reports";
import { sendEmail } from "./send";

export type SendStatus = "sent" | "skipped" | "failed";

/* ------------------------------------------------------------------ */
/* Plumbing                                                             */
/* ------------------------------------------------------------------ */

export function manageUrl(b: { code: string; manageToken: string }): string {
  return manageUrlFor(b);
}

async function safe(fn: () => Promise<SendStatus>, label: string): Promise<SendStatus> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[notify] ${label} failed`, err);
    return "failed";
  }
}

/** Addresses we must never email (Airbnb/Viator placeholders, blanks). */
function isDeliverable(email: string | null | undefined): email is string {
  const e = (email ?? "").trim().toLowerCase();
  return Boolean(e) && e.includes("@") && !e.endsWith(".invalid");
}

const DEDUPE_MS = 2 * 60_000;

async function deliver(opts: {
  template: string;
  to: string | null | undefined;
  out: EmailOutput;
  bookingId?: string | null;
  replyTo?: string;
  ics?: { filename: string; content: string };
}): Promise<SendStatus> {
  if (!isDeliverable(opts.to)) return "skipped";
  const to = opts.to.trim();
  const db = await getDb();
  const [dupe] = await db
    .select({ id: emailLog.id })
    .from(emailLog)
    .where(
      and(
        eq(emailLog.template, opts.template),
        eq(emailLog.to, to),
        eq(emailLog.subject, opts.out.subject),
        opts.bookingId ? eq(emailLog.bookingId, opts.bookingId) : sql`${emailLog.bookingId} is null`,
        inArray(emailLog.status, ["sent", "logged"]),
        gt(emailLog.createdAt, new Date(Date.now() - DEDUPE_MS)),
      ),
    )
    .limit(1);
  if (dupe) return "skipped";
  const r = await renderEmail(opts.out);
  const res = await sendEmail({
    to,
    subject: r.subject,
    html: r.html,
    text: r.text,
    template: opts.template,
    bookingId: opts.bookingId ?? null,
    replyTo: opts.replyTo,
    attachments: opts.ics ? [{ filename: opts.ics.filename, content: opts.ics.content, contentType: "text/calendar; charset=utf-8; method=PUBLISH" }] : undefined,
  });
  return res.ok ? "sent" : "failed";
}

/** Combine statuses: failed wins, then sent, then skipped. */
const worst = (...s: SendStatus[]): SendStatus => (s.includes("failed") ? "failed" : s.includes("sent") ? "sent" : "skipped");

/** The record's own language (captured from the browser) wins when it says Spanish; else the customer profile. */
async function customerLang(email: string | null | undefined, stored?: string | null): Promise<Lang> {
  if (stored === "es") return "es";
  if (!email) return "en";
  const db = await getDb();
  const [c] = await db.select({ language: customers.language }).from(customers).where(eq(customers.email, email.trim().toLowerCase())).limit(1);
  return langOf(c?.language);
}

const SOURCE_LABEL: Record<string, string> = { direct: "Website", airbnb: "Airbnb", viator: "Viator", manual: "Manual", cal: "Cal.com", phone: "Phone" };

/* ------------------------------------------------------------------ */
/* Booking loading                                                      */
/* ------------------------------------------------------------------ */

type Loaded = { b: Booking; e: Experience; addons: { name: string; quantity: number; totalCents: number }[]; promoCode: string | null };

async function loadBooking(bookingId: string): Promise<Loaded | undefined> {
  const db = await getDb();
  const [row] = await db
    .select({ b: bookings, e: experiences })
    .from(bookings)
    .innerJoin(experiences, eq(bookings.experienceId, experiences.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!row) return undefined;
  const addons = await db
    .select({ name: bookingAddons.name, quantity: bookingAddons.quantity, totalCents: bookingAddons.totalCents })
    .from(bookingAddons)
    .where(eq(bookingAddons.bookingId, bookingId));
  let promoCode: string | null = null;
  if (row.b.promoCodeId) {
    const [p] = await db.select({ code: promoCodes.code }).from(promoCodes).where(eq(promoCodes.id, row.b.promoCodeId)).limit(1);
    promoCode = p?.code ?? null;
  }
  return { ...row, addons, promoCode };
}

async function hostContacts() {
  const [hostPhone, hostWhatsapp] = await Promise.all([getStringSetting("hostPhone"), getStringSetting("hostWhatsapp")]);
  return { hostPhone, hostWhatsapp };
}

async function viewFor(r: Loaded, audience: "purchaser" | "recipient" = "purchaser"): Promise<BookingView> {
  return buildBookingView({ booking: r.b, experience: r.e, addons: r.addons, promoCode: r.promoCode, audience, ...(await hostContacts()) });
}

/** The person attending: the gift recipient when we have their email, else the booker. */
function attendee(r: Loaded): { to: string; audience: "purchaser" | "recipient" } {
  if (r.b.isGift && isDeliverable(r.b.giftRecipientEmail)) return { to: r.b.giftRecipientEmail, audience: "recipient" };
  return { to: r.b.contactEmail, audience: "purchaser" };
}

/** Gift recipient's address when they should hear about changes too (deliverable and not the purchaser). */
function giftRecipientTo(r: Loaded): string | null {
  const to = r.b.giftRecipientEmail;
  return r.b.isGift && isDeliverable(to) && to.toLowerCase() !== r.b.contactEmail.toLowerCase() ? to : null;
}

/** SEQUENCE for calendar updates: bumps on every move, +10 once cancelled. */
async function icsSequence(b: Booking): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bookingEvents)
    .where(and(eq(bookingEvents.bookingId, b.id), eq(bookingEvents.type, "rescheduled")));
  return Math.max(Number(row?.n ?? 0), b.rescheduleCount) + (b.status === "cancelled" ? 10 : 0);
}

async function bookingIcs(v: BookingView, b: Booking, cancelled = false) {
  const ev: IcsEvent = { ...bookingIcsFields(v, b), status: cancelled ? "CANCELLED" : "CONFIRMED", sequence: await icsSequence(b) };
  return { filename: `raw-planet-${b.code}.ics`, content: buildIcs([ev], { name: BUSINESS.name }) };
}

/* ------------------------------------------------------------------ */
/* Booking lifecycle (guest)                                            */
/* ------------------------------------------------------------------ */

export async function tryBookingConfirmation(bookingId: string): Promise<SendStatus> {
  return safe(async () => {
    const r = await loadBooking(bookingId);
    if (!r) return "skipped";
    const v = await viewFor(r);
    const main = await deliver({ template: "booking_confirmation", to: r.b.contactEmail, out: bookingConfirmationEmail(v), bookingId, ics: await bookingIcs(v, r.b) });
    let gift: SendStatus = "skipped";
    if (r.b.isGift && isDeliverable(r.b.giftRecipientEmail) && r.b.giftRecipientEmail.toLowerCase() !== r.b.contactEmail.toLowerCase()) {
      const rv = await viewFor(r, "recipient");
      gift = await deliver({
        template: "gift_booking_recipient",
        to: r.b.giftRecipientEmail,
        out: giftBookingRecipientEmail({ ...rv, purchaserName: r.b.contactName }),
        bookingId,
        ics: await bookingIcs(rv, r.b),
      });
    }
    return worst(main, gift);
  }, "confirmation");
}

export async function sendBookingConfirmation(bookingId: string): Promise<void> {
  await tryBookingConfirmation(bookingId);
}

export async function sendBookingCancelled(bookingId: string, refund: { cardCents: number; giftCardCents: number }): Promise<void> {
  await safe(async () => {
    const r = await loadBooking(bookingId);
    if (!r) return "skipped";
    const v = await viewFor(r);
    const main = await deliver({
      template: "booking_cancelled",
      to: r.b.contactEmail,
      out: bookingCancelledEmail({
        ...v,
        cardRefund: refund.cardCents > 0 ? money(refund.cardCents) : null,
        giftRefund: refund.giftCardCents > 0 ? money(refund.giftCardCents) : null,
        paidSomething: r.b.amountPaidCents > 0 || r.b.giftCardCents > 0,
      }),
      bookingId,
      ics: await bookingIcs(v, r.b, true),
    });
    const to = giftRecipientTo(r);
    if (!to) return main;
    const rv = await viewFor(r, "recipient");
    const gift = await deliver({
      template: "booking_cancelled",
      to,
      out: bookingCancelledEmail({ ...rv, cardRefund: null, giftRefund: null, paidSomething: false }),
      bookingId,
      ics: await bookingIcs(rv, r.b, true),
    });
    return worst(main, gift);
  }, "cancelled");
}

export async function sendBookingRescheduled(bookingId: string, previousStartAt: Date): Promise<void> {
  await safe(async () => {
    const r = await loadBooking(bookingId);
    if (!r) return "skipped";
    const v = await viewFor(r);
    const prevEnd = new Date(previousStartAt.getTime() + r.b.durationMinutes * 60_000);
    const previousLabel = `${fmtDayYear(previousStartAt, v.lang)}, ${fmtRange(previousStartAt, prevEnd, v.lang)}`;
    const main = await deliver({
      template: "booking_rescheduled",
      to: r.b.contactEmail,
      out: bookingRescheduledEmail({ ...v, previousLabel }),
      bookingId,
      ics: await bookingIcs(v, r.b),
    });
    const to = giftRecipientTo(r);
    if (!to) return main;
    const rv = await viewFor(r, "recipient");
    const gift = await deliver({ template: "booking_rescheduled", to, out: bookingRescheduledEmail({ ...rv, previousLabel }), bookingId, ics: await bookingIcs(rv, r.b) });
    return worst(main, gift);
  }, "rescheduled");
}

export async function tryBookingReminder(bookingId: string, now = new Date()): Promise<SendStatus> {
  return safe(async () => {
    const r = await loadBooking(bookingId);
    if (!r || r.b.status !== "confirmed") return "skipped";
    const who = attendee(r);
    const v = await viewFor(r, who.audience);
    const sameDay = localDateKey(r.b.startAt) === localDateKey(now);
    const dayWord = v.lang === "es" ? (sameDay ? "hoy" : "mañana") : sameDay ? "today" : "tomorrow";
    return deliver({ template: "booking_reminder", to: who.to, out: bookingReminderEmail({ ...v, dayWord }), bookingId });
  }, "reminder");
}

export async function sendBookingReminder(bookingId: string): Promise<void> {
  await tryBookingReminder(bookingId);
}

export async function tryFollowup(bookingId: string): Promise<SendStatus> {
  return safe(async () => {
    const r = await loadBooking(bookingId);
    if (!r || r.b.status === "cancelled" || r.b.status === "no_show" || r.b.status === "expired") return "skipped";
    const who = attendee(r);
    return deliver({ template: "followup_review", to: who.to, out: followupEmail(await viewFor(r, who.audience)), bookingId });
  }, "followup");
}

export async function sendFollowup(bookingId: string): Promise<void> {
  await tryFollowup(bookingId);
}

async function hasReview(bookingId: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.bookingId, bookingId)).limit(1);
  return Boolean(row);
}

/** One gentle review reminder, a few days after the thank-you (skipped if they already reviewed). */
export async function tryReviewNudge(bookingId: string): Promise<SendStatus> {
  return safe(async () => {
    const r = await loadBooking(bookingId);
    if (!r || r.b.status === "cancelled" || r.b.status === "no_show") return "skipped";
    if (await hasReview(bookingId)) return "skipped";
    const who = attendee(r);
    return deliver({ template: "review_nudge", to: who.to, out: reviewNudgeEmail(await viewFor(r, who.audience)), bookingId });
  }, "review nudge");
}

export async function sendReviewNudge(bookingId: string): Promise<void> {
  await tryReviewNudge(bookingId);
}

export async function sendDeliverableReady(bookingId: string): Promise<void> {
  await safe(async () => {
    const r = await loadBooking(bookingId);
    if (!r || !r.b.deliverableUrl) return "skipped";
    const who = attendee(r);
    const v = await viewFor(r, who.audience);
    const sent = await deliver({
      template: "deliverable_ready",
      to: who.to,
      out: deliverableReadyEmail({ ...v, deliverableUrl: r.b.deliverableUrl, deliverableReady: true, hasReview: await hasReview(bookingId) }),
      bookingId,
    });
    // The purchaser of a gifted session gets a copy too (it's their booking).
    if (who.audience === "recipient") {
      const pv = await viewFor(r);
      await deliver({
        template: "deliverable_ready",
        to: r.b.contactEmail,
        out: deliverableReadyEmail({ ...pv, deliverableUrl: r.b.deliverableUrl, deliverableReady: true, hasReview: true }),
        bookingId,
      });
    }
    return sent;
  }, "deliverable");
}

export async function sendSlotConflictRefund(bookingId: string): Promise<void> {
  await safe(async () => {
    const r = await loadBooking(bookingId);
    if (!r) return "skipped";
    const refunded = r.b.amountRefundedCents || r.b.amountPaidCents;
    return deliver({ template: "slot_conflict_refund", to: r.b.contactEmail, out: slotConflictRefundEmail({ ...(await viewFor(r)), refund: money(refunded), giftShort: r.b.cancelReason?.startsWith("Gift card") ?? false }), bookingId });
  }, "conflict");
}

export async function tryAbandonedCheckout(bookingId: string): Promise<SendStatus> {
  return safe(async () => {
    const r = await loadBooking(bookingId);
    if (!r || r.b.status !== "expired") return "skipped";
    return deliver({ template: "abandoned_checkout", to: r.b.contactEmail, out: abandonedCheckoutEmail(await viewFor(r)), bookingId });
  }, "abandoned");
}

export async function sendAbandonedCheckout(bookingId: string): Promise<void> {
  await tryAbandonedCheckout(bookingId);
}

/* ------------------------------------------------------------------ */
/* Host alerts                                                          */
/* ------------------------------------------------------------------ */

async function hostView(r: Loaded, kind: HostBookingView["kind"]): Promise<HostBookingView> {
  const db = await getDb();
  const { b, e } = r;
  const evs = await db
    .select()
    .from(bookingEvents)
    .where(and(eq(bookingEvents.bookingId, b.id), gt(bookingEvents.createdAt, new Date(Date.now() - 15 * 60_000))))
    .orderBy(desc(bookingEvents.createdAt));
  const warnings = evs.filter((x) => x.type === "calendar_error" || x.type === "conflict").map((x) => x.message);
  let previousLabel: string | null = null;
  if (kind === "rescheduled") {
    const [mv] = await db
      .select()
      .from(bookingEvents)
      .where(and(eq(bookingEvents.bookingId, b.id), eq(bookingEvents.type, "rescheduled")))
      .orderBy(desc(bookingEvents.createdAt))
      .limit(1);
    const from = typeof mv?.data?.from === "string" ? new Date(mv.data.from) : null;
    if (from && !Number.isNaN(from.getTime())) previousLabel = `${fmt(from, "EEE, MMM d")}, ${fmtRange(from, new Date(from.getTime() + b.durationMinutes * 60_000), "en")}`;
  }
  let refundLabel: string | null = null;
  if (kind === "cancelled") {
    const rows = await db.select().from(refunds).where(eq(refunds.bookingId, b.id));
    const card = rows.reduce((s, x) => s + x.amountCents, 0);
    const gift = rows.reduce((s, x) => s + x.giftCardCents, 0);
    refundLabel = [card ? `${money(card)} to card` : null, gift ? `${money(gift)} to gift card` : null].filter(Boolean).join(" + ") || null;
  }
  const paidCents = b.amountPaidCents - b.amountRefundedCents;
  return {
    kind,
    id: b.id,
    code: b.code,
    theme: e.theme,
    experienceName: e.name,
    dateLabel: fmt(b.startAt, "EEE, MMM d, yyyy"),
    timeLabel: fmtRange(b.startAt, b.endAt, "en"),
    durationLabel: fmtDur(b.durationMinutes, "en"),
    guests: b.guests,
    contactName: b.contactName,
    contactEmail: isDeliverable(b.contactEmail) ? b.contactEmail : null,
    contactPhone: b.contactPhone,
    language: b.language,
    sourceLabel: `${SOURCE_LABEL[b.source] ?? b.source}${b.externalRef ? ` ${b.externalRef}` : ""}`,
    total: money(b.totalCents),
    paid: b.paymentStatus === "not_required" ? money(b.totalCents) : money(Math.max(0, paidCents)),
    addons: r.addons.map((a) => (a.quantity > 1 ? `${a.name} × ${a.quantity}` : a.name)),
    promo: r.promoCode ? `${r.promoCode} (−${money(b.discountCents)})` : null,
    giftCardUsed: b.giftCardCents > 0 ? money(b.giftCardCents) : null,
    occasion: b.occasion,
    notes: b.customerNotes,
    isGift: b.isGift,
    giftRecipientName: b.giftRecipientName,
    previousLabel,
    cancelReason: b.cancelReason,
    cancelledBy: b.cancelledBy === "customer" ? "guest" : b.cancelledBy,
    refundLabel,
    warnings,
    adminUrl: siteUrl(`/admin/bookings/${b.id}`),
    hoursUntil: Math.round((b.startAt.getTime() - Date.now()) / 3600_000),
  };
}

export async function sendHostBookingAlert(bookingId: string, kind: "new" | "cancelled" | "rescheduled"): Promise<void> {
  await safe(async () => {
    const r = await loadBooking(bookingId);
    if (!r) return "skipped";
    return deliver({
      template: `host_${kind}`,
      to: hostNotificationEmail(),
      out: hostBookingAlertEmail(await hostView(r, kind)),
      bookingId,
      replyTo: isDeliverable(r.b.contactEmail) ? r.b.contactEmail : undefined,
    });
  }, "host alert");
}

/* ------------------------------------------------------------------ */
/* Gift cards                                                           */
/* ------------------------------------------------------------------ */

export async function tryGiftCardEmails(giftCardId: string, opts: { purchaserReceipt: boolean; recipient: boolean }): Promise<SendStatus> {
  return safe(async () => {
    const db = await getDb();
    const [card] = await db.select().from(giftCards).where(eq(giftCards.id, giftCardId)).limit(1);
    if (!card || card.status === "void" || card.status === "pending_payment") return "skipped";
    const lang = await customerLang(card.purchaserEmail, card.language);
    const scheduled = !opts.recipient && card.recipientEmail && !card.deliveredAt && card.deliverAt && card.deliverAt > new Date() ? card.deliverAt : null;
    const v: GiftCardView = {
      lang,
      code: card.code,
      amount: money(card.initialCents),
      purchaserName: card.purchaserName,
      recipientName: card.recipientName,
      recipientEmail: card.recipientEmail,
      message: card.message,
      scheduledLabel: scheduled ? fmtDay(scheduled, lang) : null,
      issuedByAdmin: card.issuedByAdmin,
      bookUrl: siteUrl("/book"),
      giftCardsUrl: siteUrl("/gift-cards"),
    };
    const receipt = opts.purchaserReceipt ? await deliver({ template: "gift_card_receipt", to: card.purchaserEmail, out: giftCardReceiptEmail(v) }) : "skipped";
    const recipient =
      opts.recipient && isDeliverable(card.recipientEmail)
        ? await deliver({ template: "gift_card_recipient", to: card.recipientEmail, out: giftCardRecipientEmail(v), replyTo: undefined })
        : "skipped";
    return worst(receipt, recipient);
  }, "gift card");
}

export async function sendGiftCardEmails(giftCardId: string, opts: { purchaserReceipt: boolean; recipient: boolean }): Promise<void> {
  await tryGiftCardEmails(giftCardId, opts);
}

/* ------------------------------------------------------------------ */
/* Inquiries, waitlist, RSVPs, manage links                             */
/* ------------------------------------------------------------------ */

export async function sendInquiryEmails(inquiryId: string): Promise<void> {
  await safe(async () => {
    const db = await getDb();
    const [q] = await db.select().from(inquiries).where(eq(inquiries.id, inquiryId)).limit(1);
    if (!q) return "skipped";
    const [exp] = q.experienceId ? await db.select().from(experiences).where(eq(experiences.id, q.experienceId)).limit(1) : [];
    const lang = await customerLang(q.email, q.language);
    const dateLabel = (l: Lang) =>
      q.preferredDate && /^\d{4}-\d{2}-\d{2}$/.test(q.preferredDate) ? fmtDayYear(fromLocal(q.preferredDate, "12:00"), l) : q.preferredDate;
    const base = {
      id: q.id,
      kind: q.kind as InquiryKind,
      name: q.name,
      email: q.email,
      phone: q.phone,
      theme: exp?.theme ?? null,
      groupSize: q.groupSize,
      message: q.message,
      receivedLabel: fmt(q.createdAt, "EEE, MMM d 'at' h:mmaaa"),
      adminUrl: siteUrl(`/admin/inquiries?id=${q.id}`),
      faqUrl: siteUrl("/faq"),
      bookUrl: exp ? siteUrl(`/book/${exp.slug}`) : siteUrl("/book"),
    };
    const guest = await deliver({
      template: "inquiry_reply",
      to: q.email,
      out: inquiryAutoReplyEmail({ ...base, lang, experienceName: exp ? experienceName(exp, lang) : null, preferredDate: dateLabel(lang) }),
    });
    const host = await deliver({
      template: "inquiry_host",
      to: hostNotificationEmail(),
      out: inquiryHostAlertEmail({ ...base, lang, experienceName: exp?.name ?? null, preferredDate: dateLabel("en") }),
      replyTo: isDeliverable(q.email) ? q.email : undefined,
    });
    return worst(guest, host);
  }, "inquiry");
}

export async function sendWaitlistOpening(entryId: string): Promise<void> {
  await safe(async () => {
    const db = await getDb();
    const [row] = await db
      .select({ w: waitlist, e: experiences })
      .from(waitlist)
      .innerJoin(experiences, eq(waitlist.experienceId, experiences.id))
      .where(eq(waitlist.id, entryId))
      .limit(1);
    if (!row) return "skipped";
    const lang = await customerLang(row.w.email, row.w.language);
    const day = fromLocal(row.w.date, "12:00");
    return deliver({
      template: "waitlist_opening",
      to: row.w.email,
      out: waitlistOpeningEmail({
        lang,
        name: row.w.name,
        theme: row.e.theme,
        experienceName: experienceName(row.e, lang),
        dateLabel: fmtDay(day, lang),
        guestsLabel: fmtGuests(row.w.guests, lang),
        bookUrl: siteUrl(`/book/${row.e.slug}?date=${row.w.date}&guests=${row.w.guests}`),
      }),
    });
  }, "waitlist");
}

export async function sendEventRsvp(rsvpId: string): Promise<void> {
  await safe(async () => {
    const db = await getDb();
    const [row] = await db.select({ r: eventRsvps, ev: events }).from(eventRsvps).innerJoin(events, eq(eventRsvps.eventId, events.id)).where(eq(eventRsvps.id, rsvpId)).limit(1);
    if (!row || row.r.status === "pending_payment") return "skipped";
    const { r, ev } = row;
    const lang = await customerLang(r.email, r.language);
    const cancelled = r.status === "cancelled" || ev.status === "cancelled";
    const address = realAddress(ev.address);
    const location = [ev.venue, ev.address].filter(Boolean).join(", ");
    const eventUrl = siteUrl(`/events/${ev.slug}`);
    const ics = buildIcs(
      [
        {
          uid: `event-${ev.id}@rawplanetexperiences.com`,
          start: ev.startAt,
          end: ev.endAt,
          summary: ev.title,
          description: [ev.summary, eventUrl].filter(Boolean).join("\n\n"),
          location: location || undefined,
          url: eventUrl,
          status: cancelled ? "CANCELLED" : "CONFIRMED",
          sequence: Math.floor(ev.updatedAt.getTime() / 1000) % 2_000_000_000,
        },
      ],
      { name: BUSINESS.name },
    );
    return deliver({
      template: cancelled ? "event_rsvp_cancelled" : "event_rsvp",
      to: r.email,
      out: eventRsvpEmail({
        lang,
        name: r.name,
        title: ev.title,
        summary: ev.summary,
        dateLabel: fmtDayYear(ev.startAt, lang),
        timeLabel: fmtRange(ev.startAt, ev.endAt, lang),
        venue: ev.venue,
        address: ev.address,
        mapUrl: mapUrlFor(address),
        guests: r.guests,
        guestsLabel: fmtGuests(r.guests, lang),
        eventUrl,
        meetupUrl: ev.meetupUrl || BUSINESS.meetupGroupUrl || null,
        googleCalendarUrl: googleCalendarUrl({ start: ev.startAt, end: ev.endAt, summary: ev.title, description: eventUrl, location: location || undefined }),
        cancelled,
      }),
      ics: { filename: `raw-planet-${ev.slug}.ics`, content: ics },
    });
  }, "rsvp");
}

/**
 * "Email me my booking links". Only ever sends to the address asked about,
 * and sends nothing when that address has never booked (no spam relay).
 */
export async function sendManageLinks(email: string): Promise<void> {
  await safe(async () => {
    const addr = email.trim().toLowerCase();
    if (!isDeliverable(addr)) return "skipped";
    const db = await getDb();
    const rows = await db
      .select({ b: bookings, e: experiences })
      .from(bookings)
      .innerJoin(experiences, eq(bookings.experienceId, experiences.id))
      .where(and(sql`lower(${bookings.contactEmail}) = ${addr}`, inArray(bookings.status, ["confirmed", "completed"])))
      .orderBy(asc(bookings.startAt));
    if (!rows.length) return "skipped";
    const now = new Date();
    const lang = langOf(rows[rows.length - 1].b.language);
    const item = ({ b, e }: (typeof rows)[number]): ManageLinkItem => ({
      code: b.code,
      experienceName: experienceName(e, lang),
      dateLabel: fmtDayShort(b.startAt, lang),
      timeLabel: fmtRange(b.startAt, b.endAt, lang),
      manageUrl: manageUrlFor(b),
      theme: e.theme,
    });
    const upcoming = rows.filter((x) => x.b.status === "confirmed" && x.b.endAt > now).map(item);
    const past = rows
      .filter((x) => x.b.endAt <= now)
      .slice(-3)
      .reverse()
      .map(item);
    return deliver({
      template: "manage_links",
      to: addr,
      out: manageLinksEmail({ lang, name: rows[rows.length - 1].b.contactName, upcoming, past, bookUrl: siteUrl("/book") }),
    });
  }, "manage links");
}

/* ------------------------------------------------------------------ */
/* Host morning digest                                                  */
/* ------------------------------------------------------------------ */

/** Today's + tomorrow's run sheet and anything that needs Alex. Skipped on a completely empty day. */
export async function tryHostDigest(now = new Date()): Promise<SendStatus> {
  return safe(async () => {
    const db = await getDb();
    const today = localDateKey(now);
    const tomorrow = addDaysKey(today, 1);
    const dayStart = fromLocal(today);
    const dayAfter = fromLocal(addDaysKey(today, 2));
    const rows = await db
      .select({ b: bookings, e: experiences })
      .from(bookings)
      .innerJoin(experiences, eq(bookings.experienceId, experiences.id))
      .where(and(inArray(bookings.status, ["confirmed", "completed"]), gte(bookings.startAt, dayStart), sql`${bookings.startAt} < ${dayAfter}`))
      .orderBy(asc(bookings.startAt));

    const emails = [...new Set(rows.map((r) => r.b.contactEmail.toLowerCase()))];
    const returning = new Set<string>();
    if (emails.length) {
      const prior = await db
        .select({ email: sql<string>`lower(${bookings.contactEmail})` })
        .from(bookings)
        .where(and(inArray(sql`lower(${bookings.contactEmail})`, emails), eq(bookings.status, "completed"), sql`${bookings.startAt} < ${dayStart}`));
      for (const p of prior) returning.add(p.email);
    }
    const session = ({ b, e }: (typeof rows)[number]): DigestSession => ({
      id: b.id,
      time: fmtClock(b.startAt, "en"),
      experienceName: e.shortName,
      theme: e.theme,
      contactName: b.isGift && b.giftRecipientName ? `${b.giftRecipientName} (gift from ${b.contactName})` : b.contactName,
      guests: b.guests,
      sourceLabel: SOURCE_LABEL[b.source] ?? b.source,
      phone: b.contactPhone,
      notes: b.customerNotes || null,
      flags: [
        b.occasion,
        b.language === "es" ? "Español" : null,
        returning.has(b.contactEmail.toLowerCase()) ? "Returning guest" : null,
        b.paymentStatus === "unpaid" && b.totalCents > 0 ? `Unpaid ${money(b.totalCents)}` : null,
      ].filter((f): f is string => Boolean(f)),
      adminUrl: siteUrl(`/admin/bookings/${b.id}`),
    });
    const todays = rows.filter((r) => localDateKey(r.b.startAt) === today).map(session);
    const tomorrows = rows.filter((r) => localDateKey(r.b.startAt) === tomorrow).map(session);

    // Needs attention
    const attention: { text: string; url: string }[] = [];
    const [newInq] = await db.select({ n: sql<number>`count(*)::int` }).from(inquiries).where(eq(inquiries.status, "new"));
    if (Number(newInq?.n) > 0) attention.push({ text: `${newInq.n} new inquir${Number(newInq.n) === 1 ? "y" : "ies"} waiting for a reply`, url: siteUrl("/admin/inquiries") });
    const tracks = await db
      .select({ id: bookings.id, code: bookings.code, endAt: bookings.endAt })
      .from(bookings)
      .innerJoin(experiences, eq(bookings.experienceId, experiences.id))
      .where(
        and(
          eq(experiences.theme, "production"),
          inArray(bookings.status, ["confirmed", "completed"]),
          sql`${bookings.deliverableStatus} <> 'delivered'`,
          sql`${bookings.endAt} < ${new Date(now.getTime() - 3 * 86400_000)}`,
          sql`${bookings.endAt} > ${new Date(now.getTime() - 45 * 86400_000)}`,
        ),
      );
    for (const t of tracks.slice(0, 5))
      attention.push({
        text: `Track for ${t.code} not delivered yet (${Math.floor((now.getTime() - t.endAt.getTime()) / 86400_000)} days)`,
        url: siteUrl(`/admin/bookings/${t.id}`),
      });
    const calErrors = await db
      .select({ bookingId: bookingEvents.bookingId, type: bookingEvents.type, createdAt: bookingEvents.createdAt })
      .from(bookingEvents)
      .where(and(inArray(bookingEvents.type, ["calendar_error", "calendar_resolved"]), gt(bookingEvents.createdAt, new Date(now.getTime() - 14 * 86400_000))))
      .orderBy(asc(bookingEvents.createdAt));
    const open = new Map<string, boolean>();
    for (const c of calErrors) open.set(c.bookingId, c.type === "calendar_error");
    const openIds = [...open].filter(([, v]) => v).map(([k]) => k);
    if (openIds.length)
      attention.push({
        text: `${openIds.length} booking${openIds.length === 1 ? "" : "s"} couldn't sync to the shared calendar. Check Google/Cal.com`,
        url: openIds.length === 1 ? siteUrl(`/admin/bookings/${openIds[0]}`) : siteUrl("/admin"),
      });
    const badFeeds = await db.select({ name: calendarFeeds.name }).from(calendarFeeds).where(and(eq(calendarFeeds.active, true), sql`${calendarFeeds.lastError} is not null`));
    for (const f of badFeeds) attention.push({ text: `Calendar feed “${f.name}” isn't syncing`, url: siteUrl("/admin/availability") });
    const unpaid = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(eq(bookings.status, "confirmed"), eq(bookings.paymentStatus, "unpaid"), gt(bookings.totalCents, 0), gt(bookings.startAt, now), sql`${bookings.startAt} < ${new Date(now.getTime() + 7 * 86400_000)}`));
    if (Number(unpaid[0]?.n) > 0) attention.push({ text: `${unpaid[0].n} upcoming booking${Number(unpaid[0].n) === 1 ? "" : "s"} not paid yet`, url: siteUrl("/admin/bookings") });

    if (!todays.length && !tomorrows.length && !attention.length) return "skipped";

    // Stats
    const [booked] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(inArray(bookings.status, ["confirmed", "completed"]), gt(bookings.createdAt, new Date(now.getTime() - 86400_000))));
    const monthStart = fromLocal(`${today.slice(0, 7)}-01`);
    const [rev] = await db
      .select({ c: sql<number>`coalesce(sum(${bookings.amountPaidCents} - ${bookings.amountRefundedCents}), 0)::int` })
      .from(bookings)
      .where(gte(bookings.confirmedAt, monthStart));
    const [week] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(eq(bookings.status, "confirmed"), gte(bookings.startAt, dayStart), sql`${bookings.startAt} < ${fromLocal(addDaysKey(today, 7))}`));

    return deliver({
      template: "host_digest",
      to: hostNotificationEmail(),
      out: hostDigestEmail({
        dateLabel: fmt(now, "EEEE, MMMM d"),
        tomorrowLabel: `Tomorrow, ${fmt(fromLocal(tomorrow, "12:00"), "EEEE")}`,
        today: todays,
        tomorrow: tomorrows,
        stats: [
          { label: "Booked in 24h", value: String(booked?.n ?? 0) },
          { label: "This month", value: money(Number(rev?.c ?? 0)) },
          { label: "Next 7 days", value: String(week?.n ?? 0) },
        ],
        attention,
        adminUrl: siteUrl("/admin"),
        calendarUrl: siteUrl("/admin/calendar"),
      }),
    });
  }, "host digest");
}

/** Last Monday to Sunday, for the host. Skipped when nothing happened at all. */
export async function tryWeeklyReport(now = new Date()): Promise<SendStatus> {
  return safe(async () => {
    const thisWeek = weekStartKey(localDateKey(now));
    const from = addDaysKey(thisWeek, -7);
    const to = addDaysKey(thisWeek, -1);
    const [r, before] = await Promise.all([getReport({ from, to, preset: null }, now), getCashEntries(fromLocal(addDaysKey(from, -7)), fromLocal(from))]);
    const net = r.revenue.totalCents;
    if (!r.rates.sessions && !net) return "skipped";
    const sessions = r.rates.sessions - r.rates.cancelled;
    const pct = (rate: number | null) => (rate === null ? "–" : `${Math.round(rate * 100)}%`);
    const top = r.revenue.byExperience[0];
    const notes = [
      `Revenue the week before was ${money(sumCash(before))}.`,
      top && top.cents > 0 ? `${top.label} earned the most: ${money(top.cents)}.` : null,
      r.rates.cancelled ? `${r.rates.cancelled} cancelled.` : null,
      r.rates.noShows ? `${r.rates.noShows} no-show${r.rates.noShows === 1 ? "" : "s"}.` : null,
      r.giftCards.soldCount ? `${r.giftCards.soldCount} gift card${r.giftCards.soldCount === 1 ? "" : "s"} sold for ${money(r.giftCards.soldCents)}.` : null,
      r.abandoned.recovered ? `${r.abandoned.recovered} abandoned checkout${r.abandoned.recovered === 1 ? "" : "s"} came back after the reminder.` : null,
      r.smartPricing.bookings ? `Smart pricing changed ${r.smartPricing.bookings} booking${r.smartPricing.bookings === 1 ? "" : "s"} by ${money(r.smartPricing.netCents)} overall.` : null,
    ].filter((n): n is string => Boolean(n));
    return deliver({
      template: "host_weekly_report",
      to: hostNotificationEmail(),
      out: hostWeeklyReportEmail({
        weekLabel: `${fmt(fromLocal(from, "12:00"), "MMM d")} to ${fmt(fromLocal(to, "12:00"), "MMM d")}`,
        netRevenue: money(net),
        sessions,
        stats: [
          { label: "Revenue", value: money(net) },
          { label: "Sessions", value: String(sessions) },
          { label: "Studio booked", value: pct(r.occupancy.openHours ? r.occupancy.bookedHours / r.occupancy.openHours : null) },
          { label: "Repeat guests", value: pct(r.repeat.rate) },
        ],
        notes,
        reportUrl: siteUrl(`/admin/reports?from=${from}&to=${to}`),
      }),
    });
  }, "weekly report");
}

export async function sendHostDigest(now = new Date()): Promise<void> {
  await tryHostDigest(now);
}
