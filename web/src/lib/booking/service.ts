/**
 * Booking service — the single place where booking state changes.
 * API routes, server actions, webhooks, admin and cron all call into here.
 *
 * Lifecycle:
 *   createBooking ─► pending_payment (slot held CHECKOUT_HOLD_MINUTES)
 *        │                 ├─ Stripe paid ─► fulfillBooking ─► confirmed ─► completed / no_show
 *        │                 └─ hold lapses ─► expired
 *        └─ total = $0 (gift card / 100% code) ─► confirmed immediately
 *   confirmed ─► cancelBooking (policy refund) ─► cancelled
 *   confirmed ─► rescheduleBooking ─► confirmed (new time)
 */
import "server-only";
import { and, eq, gt, gte, inArray, lt, sql, type SQL } from "drizzle-orm";
import { getDb, type DB, type Tx } from "@/lib/db";
import {
  addons as addonsTable,
  bookingAddons,
  bookingEvents,
  bookings,
  customers,
  experiences,
  giftCards,
  giftCardTransactions,
  promoCodes,
  refunds,
  waitlist,
  type Booking,
  type BookingSource,
  type Experience,
} from "@/lib/db/schema";
import { CHECKOUT_HOLD_MINUTES, integrations, siteUrl } from "@/lib/config";
import { newBookingCode, newToken, normalizeCode } from "@/lib/ids";
import { fmtDateShort, fmtDuration, fmtTimeRange, localDateKey } from "@/lib/time";
import { computeQuote, refundForCancellation, type Quote } from "./pricing";
import { isSlotFree } from "./availability";
import {
  CalcomError,
  calCancelBooking,
  calCreateBooking,
  calReleaseSlot,
  calRescheduleBooking,
  calReserveSlot,
} from "@/lib/integrations/calcom";
import { createCheckoutSession, expireCheckoutSession, refundPayment } from "@/lib/integrations/stripe";
import * as notify from "@/lib/email/notify";

export class BookingError extends Error {
  constructor(
    message: string,
    public code:
      | "not_found"
      | "slot_unavailable"
      | "invalid"
      | "policy"
      | "payment"
      | "calendar" = "invalid",
  ) {
    super(message);
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

export async function logEvent(
  db: DB | Tx,
  bookingId: string,
  type: string,
  message: string,
  opts: { public?: boolean; actor?: "system" | "admin" | "customer"; data?: Record<string, unknown> } = {},
) {
  await db.insert(bookingEvents).values({
    bookingId,
    type,
    message,
    public: opts.public ?? false,
    actor: opts.actor ?? "system",
    data: opts.data ?? null,
  });
}

/** Serialise all writes for one resource group (prevents double-booking races). */
async function lockResource(tx: Tx, resourceGroup: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"rp:" + resourceGroup}))`);
}

async function upsertCustomer(
  tx: Tx,
  c: { email: string; name: string; phone?: string | null; language?: string; marketingOptIn?: boolean },
  opts: { updateExisting?: boolean } = {},
): Promise<string> {
  const email = c.email.trim().toLowerCase();
  const [existing] = await tx.select().from(customers).where(eq(customers.email, email)).limit(1);
  // Public checkouts are unverified: they never rewrite an existing profile (fulfillBooking does, once paid).
  if (existing && opts.updateExisting === false) return existing.id;
  if (existing) {
    await tx
      .update(customers)
      .set({
        name: c.name || existing.name,
        phone: c.phone || existing.phone,
        language: c.language ?? existing.language,
        marketingOptIn: existing.marketingOptIn || Boolean(c.marketingOptIn),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, existing.id));
    return existing.id;
  }
  const [row] = await tx
    .insert(customers)
    .values({ email, name: c.name, phone: c.phone ?? null, language: c.language ?? "en", marketingOptIn: Boolean(c.marketingOptIn) })
    .returning({ id: customers.id });
  return row.id;
}

export async function getBooking(idOrCode: string): Promise<Booking | undefined> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(bookings)
    .where(idOrCode.startsWith("RP-") ? eq(bookings.code, normalizeCode(idOrCode)) : eq(bookings.id, idOrCode))
    .limit(1);
  return row;
}

/** Look up a booking for the customer's manage page; constant-time-ish token check. */
export async function getBookingForCustomer(code: string, token: string): Promise<Booking | undefined> {
  const b = await getBooking(normalizeCode(code));
  if (!b || !token || b.manageToken.length !== token.length) return undefined;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= b.manageToken.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0 ? b : undefined;
}

/* ------------------------------------------------------------------ */
/* Quote (shared by API + checkout)                                     */
/* ------------------------------------------------------------------ */

/** Unpaid checkouts whose hold hasn't lapsed, matching `where` (count + gift card cents they reserve). */
async function liveHolds(db: DB | Tx, where: SQL): Promise<{ n: number; cents: number }> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int`, cents: sql<number>`coalesce(sum(${bookings.giftCardCents}), 0)::int` })
    .from(bookings)
    .where(and(where, eq(bookings.status, "pending_payment"), gt(bookings.holdExpiresAt, new Date())));
  return { n: Number(r?.n ?? 0), cents: Number(r?.cents ?? 0) };
}

export type QuoteRequest = {
  experienceId: string;
  durationMinutes: number;
  guests: number;
  addonIds?: string[];
  promoCode?: string | null;
  giftCardCode?: string | null;
};

export async function buildQuote(
  db: DB | Tx,
  req: QuoteRequest,
): Promise<{ experience: Experience; quote: Quote; promoId: string | null; giftCardId: string | null; giftCardError: string | null }> {
  const [experience] = await db.select().from(experiences).where(eq(experiences.id, req.experienceId)).limit(1);
  if (!experience || !experience.active) throw new BookingError("That experience isn't available.", "not_found");

  const addonRows =
    req.addonIds && req.addonIds.length
      ? (await db.select().from(addonsTable).where(and(inArray(addonsTable.id, req.addonIds), eq(addonsTable.active, true)))).filter(
          (a) => a.experienceId === null || a.experienceId === experience.id,
        )
      : [];

  let promo = null;
  if (req.promoCode?.trim()) {
    [promo] = await db.select().from(promoCodes).where(eq(promoCodes.code, normalizeCode(req.promoCode))).limit(1);
    // Unpaid checkouts still holding their slot count toward the usage limit, so one code can't ride N open checkouts.
    if (promo?.maxRedemptions != null) promo = { ...promo, redemptions: promo.redemptions + (await liveHolds(db, eq(bookings.promoCodeId, promo.id))).n };
  }

  let giftCard = null;
  let giftCardError: string | null = null;
  if (req.giftCardCode?.trim()) {
    [giftCard] = await db.select().from(giftCards).where(eq(giftCards.code, normalizeCode(req.giftCardCode))).limit(1);
    if (!giftCard) giftCardError = "We couldn't find that gift card.";
    else {
      // Balance already promised to other open checkouts isn't available.
      const held = (await liveHolds(db, eq(bookings.giftCardId, giftCard.id))).cents;
      giftCard = { ...giftCard, balanceCents: Math.max(0, giftCard.balanceCents - held) };
      if (giftCard.status !== "active" || giftCard.balanceCents <= 0) {
        giftCardError = giftCard.status === "pending_payment" ? "That gift card isn't active yet." : "That gift card has no balance left.";
        giftCard = null;
      }
    }
  }

  const quote = computeQuote({
    experience,
    durationMinutes: req.durationMinutes,
    guests: req.guests,
    addons: addonRows.map((a) => ({ addon: a })),
    promo: promo ?? null,
    giftCardBalanceCents: giftCard?.balanceCents ?? 0,
  });
  if (req.promoCode?.trim() && !promo) quote.promoError = "We don't recognise that code.";

  return {
    experience,
    quote,
    promoId: promo && !quote.promoError ? promo.id : null,
    giftCardId: giftCard?.id ?? null,
    giftCardError,
  };
}

/* ------------------------------------------------------------------ */
/* Create (public checkout + admin manual bookings)                     */
/* ------------------------------------------------------------------ */

export type CreateBookingInput = QuoteRequest & {
  start: string; // ISO instant
  contact: { name: string; email: string; phone?: string | null };
  language?: "en" | "es";
  notes?: string;
  occasion?: string | null;
  marketingOptIn?: boolean;
  gift?: { recipientName: string; recipientEmail?: string | null; message?: string | null } | null;
};

export type CreateBookingResult = { booking: Booking; next: { type: "redirect"; url: string } };

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const db = await getDb();
  const start = new Date(input.start);
  if (Number.isNaN(start.getTime())) throw new BookingError("Pick a time.");
  if (input.promoCode && input.promoCode.length > 40) throw new BookingError("Invalid code.");

  // An address can't sit on more than a couple of unpaid checkouts (stops one person blocking the calendar).
  if ((await liveHolds(db, eq(bookings.contactEmail, input.contact.email.trim().toLowerCase()))).n >= 2)
    throw new BookingError("You already have checkouts in progress. Finish or cancel those first, or wait 30 minutes.", "policy");
  const { experience, quote, promoId, giftCardId, giftCardError } = await buildQuote(db, input);
  if (quote.promoError && input.promoCode) throw new BookingError(quote.promoError);
  if (giftCardError) throw new BookingError(giftCardError);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  const holdExpiresAt = new Date(Date.now() + CHECKOUT_HOLD_MINUTES * 60_000);

  const booking = await db.transaction(async (tx) => {
    await lockResource(tx, experience.resourceGroup);
    const free = await isSlotFree(tx, { experience, start, durationMinutes: input.durationMinutes });
    if (!free.ok) throw new BookingError("Sorry, that time was just taken. Please pick another.", "slot_unavailable");

    const customerId = await upsertCustomer(
      tx,
      { ...input.contact, language: input.language, marketingOptIn: input.marketingOptIn },
      { updateExisting: false },
    );
    const [b] = await tx
      .insert(bookings)
      .values({
        code: newBookingCode(),
        experienceId: experience.id,
        customerId,
        status: "pending_payment",
        paymentStatus: "unpaid",
        source: "direct",
        startAt: start,
        endAt: end,
        durationMinutes: input.durationMinutes,
        guests: input.guests,
        resourceGroup: experience.resourceGroup,
        contactName: input.contact.name.trim(),
        contactEmail: input.contact.email.trim().toLowerCase(),
        contactPhone: input.contact.phone?.trim() || null,
        language: input.language ?? "en",
        customerNotes: (input.notes ?? "").slice(0, 2000),
        occasion: input.occasion ?? null,
        subtotalCents: quote.subtotalCents,
        addonsCents: quote.addonsCents,
        discountCents: quote.discountCents,
        giftCardCents: quote.giftCardCents,
        totalCents: quote.totalCents,
        promoCodeId: promoId,
        giftCardId,
        isGift: Boolean(input.gift?.recipientName),
        giftRecipientName: input.gift?.recipientName ?? null,
        giftRecipientEmail: input.gift?.recipientEmail?.trim().toLowerCase() || null,
        giftMessage: input.gift?.message ?? null,
        holdExpiresAt,
        manageToken: newToken(),
      })
      .returning();
    if (quote.addonLines.length) {
      await tx.insert(bookingAddons).values(
        quote.addonLines.map((l) => ({
          bookingId: b.id,
          addonId: l.addonId,
          name: l.name,
          quantity: l.quantity,
          unitCents: l.unitCents,
          totalCents: l.totalCents,
        })),
      );
    }
    await logEvent(tx, b.id, "created", "Booking started — waiting for payment", { actor: "customer", public: false });
    return b;
  });

  // Hold the slot in Cal.com too (it re-checks Google Calendar / Airbnb).
  if (experience.calEventTypeId) {
    try {
      const r = await calReserveSlot({
        eventTypeId: experience.calEventTypeId,
        start,
        durationMinutes: input.durationMinutes,
        holdMinutes: CHECKOUT_HOLD_MINUTES + 5,
      });
      if (r) await db.update(bookings).set({ calReservationUid: r.reservationUid }).where(eq(bookings.id, booking.id));
    } catch (err) {
      await db
        .update(bookings)
        .set({ status: "expired", holdExpiresAt: null, updatedAt: new Date() })
        .where(eq(bookings.id, booking.id));
      await logEvent(db, booking.id, "expired", "Calendar rejected the slot before payment", { data: { error: String(err) } });
      throw new BookingError("Sorry, that time is no longer available. Please pick another.", "slot_unavailable");
    }
  }

  // Nothing to charge → confirm now.
  if (quote.totalCents === 0) {
    await fulfillBooking(booking.id, { amountPaidCents: 0 });
    return { booking, next: { type: "redirect", url: siteUrl(`/booking/${booking.code}?t=${booking.manageToken}`) } };
  }

  if (!integrations.stripe()) {
    if (!integrations.testCheckout()) throw new BookingError("Online payments aren't set up yet. Please contact us to book.", "payment");
    return {
      booking,
      next: { type: "redirect", url: siteUrl(`/checkout/test/booking/${booking.id}?t=${booking.manageToken}`) },
    };
  }

  const when = `${fmtDateShort(start)}, ${fmtTimeRange(start, end)} (New York time)`;
  const session = await createCheckoutSession({
    kind: "booking",
    refId: booking.id,
    email: booking.contactEmail,
    description: `${experience.name} · ${when} · ${booking.code}`,
    lines: [
      {
        name: `${experience.name} — ${fmtDuration(input.durationMinutes)}`,
        description: `${when} · ${input.guests} guest${input.guests > 1 ? "s" : ""} · ${booking.code}`,
        // Charge the final amount as one line so discounts/gift cards reconcile exactly.
        amountCents: quote.totalCents,
      },
    ],
    successUrl: siteUrl(`/booking/${booking.code}?t=${booking.manageToken}&session_id={CHECKOUT_SESSION_ID}`),
    cancelUrl: siteUrl(`/book/${experience.slug}?cancelled=${booking.code}&t=${booking.manageToken}`),
    expiresInMinutes: CHECKOUT_HOLD_MINUTES,
  });
  await db.update(bookings).set({ stripeCheckoutSessionId: session.id }).where(eq(bookings.id, booking.id));
  return { booking, next: { type: "redirect", url: session.url } };
}

/* ------------------------------------------------------------------ */
/* Payment received → confirm                                            */
/* ------------------------------------------------------------------ */

/**
 * Payment arrived for a booking that is no longer awaiting it (cancelled, no-show…).
 * Never re-confirm: record the payment once and refund it in full. Idempotent per
 * payment intent so a replayed webhook can't refund twice.
 */
async function refundLatePayment(
  b: Booking,
  payment: { amountPaidCents: number; paymentIntentId?: string | null; checkoutSessionId?: string | null },
): Promise<Booking> {
  const db = await getDb();
  if (!payment.paymentIntentId || payment.amountPaidCents <= 0) return b;
  const [already] = await db
    .select({ id: refunds.id })
    .from(refunds)
    .innerJoin(bookings, eq(bookings.id, refunds.bookingId))
    .where(and(eq(refunds.bookingId, b.id), eq(bookings.stripePaymentIntentId, payment.paymentIntentId)))
    .limit(1);
  if (already) return b;
  const r = await refundPayment({ paymentIntentId: payment.paymentIntentId, amountCents: payment.amountPaidCents, reason: "late payment", bookingId: b.id });
  await db.insert(refunds).values({ bookingId: b.id, amountCents: payment.amountPaidCents, reason: "Late payment on a cancelled booking", stripeRefundId: r?.id ?? null });
  await db
    .update(bookings)
    .set({
      stripePaymentIntentId: payment.paymentIntentId,
      amountPaidCents: b.amountPaidCents + payment.amountPaidCents,
      amountRefundedCents: b.amountRefundedCents + payment.amountPaidCents,
      paymentStatus: "refunded",
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, b.id));
  await logEvent(db, b.id, "refunded", `Payment arrived after the booking was ${b.status} — refunded ${(payment.amountPaidCents / 100).toFixed(2)} USD`, { public: true });
  return (await getBooking(b.id))!;
}

export async function fulfillBooking(
  bookingId: string,
  payment: { amountPaidCents: number; paymentIntentId?: string | null; checkoutSessionId?: string | null },
): Promise<Booking> {
  const db = await getDb();
  const pre = await getBooking(bookingId);
  if (!pre) throw new BookingError("Booking not found", "not_found");
  if (pre.status === "confirmed" || pre.status === "completed") return pre; // idempotent
  // A late payment for a booking that was cancelled / no-show must never re-confirm it:
  // record the payment and refund it in full instead.
  if (pre.status !== "pending_payment" && pre.status !== "expired") {
    return refundLatePayment(pre, payment);
  }

  const [experience] = await db.select().from(experiences).where(eq(experiences.id, pre.experienceId)).limit(1);

  const result = await db.transaction(async (tx) => {
    await lockResource(tx, pre.resourceGroup);
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (b.status === "confirmed" || b.status === "completed") return { booking: b, conflict: false, already: true };

    // Paid after the hold lapsed (or the slot got taken): re-check.
    if (b.status !== "pending_payment" || (b.holdExpiresAt && b.holdExpiresAt < new Date())) {
      const free = await isSlotFree(tx, {
        experience,
        start: b.startAt,
        durationMinutes: b.durationMinutes,
        ignoreBookingId: b.id,
        skipNotice: true,
      });
      if (!free.ok) {
        await tx
          .update(bookings)
          .set({
            status: "cancelled",
            paymentStatus: payment.amountPaidCents > 0 ? "paid" : "not_required",
            amountPaidCents: payment.amountPaidCents,
            stripePaymentIntentId: payment.paymentIntentId ?? b.stripePaymentIntentId,
            cancelledAt: new Date(),
            cancelledBy: "system",
            cancelReason: "Slot was taken before payment completed",
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, b.id));
        return { booking: b, conflict: true };
      }
    }

    // Redeem the gift card atomically. If it no longer covers its share (spent elsewhere, voided),
    // don't confirm a booking that was only partly paid: cancel and refund like a slot conflict.
    const giftCardCents = b.giftCardCents;
    if (b.giftCardId && b.giftCardCents > 0) {
      const [gc] = await tx
        .update(giftCards)
        .set({
          balanceCents: sql`${giftCards.balanceCents} - ${b.giftCardCents}`,
          status: sql`case when ${giftCards.balanceCents} - ${b.giftCardCents} = 0 then 'depleted' else 'active' end`,
        })
        .where(and(eq(giftCards.id, b.giftCardId), eq(giftCards.status, "active"), gte(giftCards.balanceCents, b.giftCardCents)))
        .returning({ id: giftCards.id });
      if (!gc) {
        await tx
          .update(bookings)
          .set({
            status: "cancelled",
            paymentStatus: payment.amountPaidCents > 0 ? "paid" : "not_required",
            amountPaidCents: payment.amountPaidCents,
            stripePaymentIntentId: payment.paymentIntentId ?? b.stripePaymentIntentId,
            cancelledAt: new Date(),
            cancelledBy: "system",
            cancelReason: "Gift card balance no longer covered this booking",
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, b.id));
        return { booking: b, conflict: true };
      }
      await tx.insert(giftCardTransactions).values({ giftCardId: gc.id, bookingId: b.id, amountCents: -b.giftCardCents, note: `Booking ${b.code}` });
    }
    if (b.promoCodeId) {
      await tx.update(promoCodes).set({ redemptions: sql`${promoCodes.redemptions} + 1` }).where(eq(promoCodes.id, b.promoCodeId));
    }

    const [updated] = await tx
      .update(bookings)
      .set({
        status: "confirmed",
        paymentStatus: payment.amountPaidCents > 0 ? "paid" : "not_required",
        amountPaidCents: payment.amountPaidCents,
        giftCardCents,
        stripePaymentIntentId: payment.paymentIntentId ?? b.stripePaymentIntentId,
        stripeCheckoutSessionId: payment.checkoutSessionId ?? b.stripeCheckoutSessionId,
        holdExpiresAt: null,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, b.id))
      .returning();
    await logEvent(
      tx,
      b.id,
      "confirmed",
      payment.amountPaidCents > 0 ? `Payment received (${(payment.amountPaidCents / 100).toFixed(2)} USD) — booking confirmed` : "Booking confirmed",
      { public: true },
    );
    // Paid: now the contact details are worth keeping on the customer profile.
    if (updated.customerId) {
      await tx
        .update(customers)
        .set({ name: updated.contactName, phone: updated.contactPhone ?? sql`${customers.phone}`, language: updated.language, updatedAt: new Date() })
        .where(eq(customers.id, updated.customerId));
    }
    return { booking: updated, conflict: false, already: false };
  });

  if (result.conflict) {
    if (payment.paymentIntentId && payment.amountPaidCents > 0) {
      const r = await refundPayment({ paymentIntentId: payment.paymentIntentId, amountCents: payment.amountPaidCents, reason: "slot conflict", bookingId });
      await db.insert(refunds).values({ bookingId, amountCents: payment.amountPaidCents, reason: "Slot conflict", stripeRefundId: r?.id ?? null });
      await db.update(bookings).set({ paymentStatus: "refunded", amountRefundedCents: payment.amountPaidCents }).where(eq(bookings.id, bookingId));
    }
    const why = (await getBooking(bookingId))?.cancelReason ?? "Slot was taken before payment completed";
    await logEvent(db, bookingId, "cancelled", `${why} — refunded in full`, { public: true });
    await notify.sendSlotConflictRefund(bookingId);
    await notify.sendHostBookingAlert(bookingId, "cancelled");
    return (await getBooking(bookingId))!;
  }

  // Another request (webhook vs. status page) confirmed it first and is doing the follow-up work.
  if (result.already) return result.booking;

  let booking = result.booking;

  // Put it on the shared calendar (Cal.com → Google → Airbnb).
  if (experience.calEventTypeId && !booking.calBookingUid) {
    await calReleaseSlot(booking.calReservationUid);
    try {
      const cal = await calCreateBooking({
        eventTypeId: experience.calEventTypeId,
        start: booking.startAt,
        durationMinutes: booking.durationMinutes,
        attendee: { name: booking.contactName, email: booking.contactEmail, phone: booking.contactPhone, language: booking.language },
        metadata: { rpBookingId: booking.id, rpCode: booking.code, guests: String(booking.guests), source: "website" },
        notes: booking.customerNotes,
      });
      if (cal) {
        [booking] = await db.update(bookings).set({ calBookingUid: cal.uid, calReservationUid: null }).where(eq(bookings.id, booking.id)).returning();
        await logEvent(db, booking.id, "calendar", "Added to calendar (Cal.com / Google)");
      }
    } catch (err) {
      // Payment is captured and our DB already holds the slot; flag for the host
      // rather than refunding automatically (Cal.com may just be down).
      const msg = err instanceof CalcomError ? err.message : String(err);
      await logEvent(db, booking.id, "calendar_error", `Couldn't add to Cal.com — please check the calendar: ${msg}`, {});
    }
  }

  await notify.sendBookingConfirmation(booking.id);
  await notify.sendHostBookingAlert(booking.id, "new");
  await db.update(bookings).set({ confirmationSentAt: new Date() }).where(eq(bookings.id, booking.id));
  return booking;
}

/* ------------------------------------------------------------------ */
/* Expire abandoned holds                                                */
/* ------------------------------------------------------------------ */

export async function expireBooking(bookingId: string, reason = "Checkout not completed"): Promise<void> {
  const db = await getDb();
  const [b] = await db
    .update(bookings)
    .set({ status: "expired", holdExpiresAt: null, updatedAt: new Date() })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, "pending_payment")))
    .returning();
  if (!b) return;
  await logEvent(db, b.id, "expired", reason);
  await calReleaseSlot(b.calReservationUid);
  await expireCheckoutSession(b.stripeCheckoutSessionId);
}

/** Expire holds that lapsed > 5 min ago (grace lets in-flight Stripe webhooks land first). */
export async function expireStaleHolds(now = new Date()): Promise<number> {
  const db = await getDb();
  const stale = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.status, "pending_payment"), lt(bookings.holdExpiresAt, new Date(now.getTime() - 5 * 60_000))));
  for (const s of stale) await expireBooking(s.id, "Hold lapsed — checkout not completed");
  return stale.length;
}

/* ------------------------------------------------------------------ */
/* Cancel                                                                */
/* ------------------------------------------------------------------ */

export type RefundMode = "policy" | "full" | "none" | { cardCents: number };

export async function cancelBooking(
  bookingId: string,
  opts: { by: "customer" | "admin" | "system"; reason?: string; refund?: RefundMode; notifyCustomer?: boolean },
): Promise<{ booking: Booking; refundedCardCents: number; refundedGiftCardCents: number }> {
  const db = await getDb();
  const b = await getBooking(bookingId);
  if (!b) throw new BookingError("Booking not found", "not_found");
  if (b.status === "pending_payment") {
    await expireBooking(b.id, "Cancelled before payment");
    return { booking: (await getBooking(b.id))!, refundedCardCents: 0, refundedGiftCardCents: 0 };
  }
  if (b.status !== "confirmed") throw new BookingError("This booking can't be cancelled.", "policy");
  const [experience] = await db.select().from(experiences).where(eq(experiences.id, b.experienceId)).limit(1);

  const policy = refundForCancellation({
    startAt: b.startAt,
    cancellationHours: experience.cancellationHours,
    amountPaidCents: b.amountPaidCents,
    amountRefundedCents: b.amountRefundedCents,
    giftCardCents: b.giftCardCents,
  });
  const mode = opts.refund ?? "policy";
  if (opts.by === "customer" && !policy.eligible) {
    throw new BookingError(
      `Free cancellation ended ${experience.cancellationHours} hours before your session. Reply to your confirmation email and we'll see what we can do.`,
      "policy",
    );
  }
  const remainingCard = Math.max(0, b.amountPaidCents - b.amountRefundedCents);
  let cardCents = 0;
  let giftCents = 0;
  if (mode === "policy") {
    cardCents = policy.cardCents;
    giftCents = policy.giftCardCents;
  } else if (mode === "full") {
    cardCents = remainingCard;
    giftCents = b.giftCardCents;
  } else if (typeof mode === "object") {
    cardCents = Math.min(remainingCard, Math.max(0, Math.round(mode.cardCents)));
  }

  if (cardCents > 0 && !b.stripePaymentIntentId && integrations.stripe())
    throw new BookingError("No Stripe payment is linked to this booking — refund it in the Stripe dashboard.", "payment");

  // Claim the cancellation first: only one concurrent request gets the row, so refunds can't run twice.
  const [claimed] = await db
    .update(bookings)
    .set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: opts.by, cancelReason: opts.reason ?? null, updatedAt: new Date() })
    .where(and(eq(bookings.id, b.id), eq(bookings.status, "confirmed")))
    .returning({ id: bookings.id });
  if (!claimed) throw new BookingError("This booking was already cancelled.", "policy");

  let stripeRefundId: string | null = null;
  if (cardCents > 0 && b.stripePaymentIntentId) {
    try {
      const r = await refundPayment({ paymentIntentId: b.stripePaymentIntentId, amountCents: cardCents, reason: opts.reason, bookingId: b.id });
      stripeRefundId = r?.id ?? null;
    } catch (err) {
      // Refund failed: put the booking back so the cancel can be retried.
      await db.update(bookings).set({ status: "confirmed", cancelledAt: null, cancelledBy: null, cancelReason: null }).where(eq(bookings.id, b.id));
      throw err;
    }
  }

  const booking = await db.transaction(async (tx) => {
    if (giftCents > 0 && b.giftCardId) {
      // Atomic credit; a voided card is never revived — the host decides what to do instead.
      const [gc] = await tx
        .update(giftCards)
        .set({ balanceCents: sql`${giftCards.balanceCents} + ${giftCents}`, status: "active" })
        .where(and(eq(giftCards.id, b.giftCardId), sql`${giftCards.status} <> 'void'`))
        .returning({ id: giftCards.id });
      if (gc) await tx.insert(giftCardTransactions).values({ giftCardId: gc.id, bookingId: b.id, amountCents: giftCents, note: `Refund for ${b.code}` });
      else {
        await logEvent(tx, b.id, "note", `Gift card is void — ${(giftCents / 100).toFixed(2)} USD was NOT returned to it. Decide whether to refund another way.`, { actor: "system" });
        giftCents = 0;
      }
    }
    if (cardCents > 0 || giftCents > 0) {
      await tx.insert(refunds).values({
        bookingId: b.id,
        amountCents: cardCents,
        giftCardCents: giftCents,
        reason: opts.reason ?? "Cancellation",
        stripeRefundId,
        createdBy: opts.by,
      });
    }
    const refunded = b.amountRefundedCents + cardCents;
    const [u] = await tx
      .update(bookings)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: opts.by,
        cancelReason: opts.reason ?? null,
        amountRefundedCents: refunded,
        paymentStatus:
          b.amountPaidCents === 0 ? b.paymentStatus : refunded >= b.amountPaidCents ? "refunded" : refunded > 0 ? "partially_refunded" : b.paymentStatus,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, b.id))
      .returning();
    const money = cardCents > 0 ? ` — ${(cardCents / 100).toFixed(2)} USD refunded to card` : "";
    const gift = giftCents > 0 ? ` — ${(giftCents / 100).toFixed(2)} USD returned to gift card` : "";
    await logEvent(tx, b.id, "cancelled", `Booking cancelled by ${opts.by}${money}${gift}`, {
      public: true,
      actor: opts.by,
      data: { reason: opts.reason },
    });
    return u;
  });

  try {
    await calCancelBooking(b.calBookingUid, opts.reason ?? `Cancelled by ${opts.by}`);
  } catch (err) {
    await logEvent(db, b.id, "calendar_error", `Couldn't remove from Cal.com — delete it manually: ${String(err)}`);
  }

  if (opts.notifyCustomer !== false) await notify.sendBookingCancelled(b.id, { cardCents, giftCardCents: giftCents });
  if (opts.by !== "admin") await notify.sendHostBookingAlert(b.id, "cancelled");
  await notifyWaitlistForDate(b.experienceId, localDateKey(b.startAt));
  return { booking, refundedCardCents: cardCents, refundedGiftCardCents: giftCents };
}

/* ------------------------------------------------------------------ */
/* Reschedule                                                            */
/* ------------------------------------------------------------------ */

export const MAX_CUSTOMER_RESCHEDULES = 2;

export async function rescheduleBooking(
  bookingId: string,
  newStartIso: string,
  opts: { by: "customer" | "admin"; durationMinutes?: number; reason?: string; force?: boolean; notifyCustomer?: boolean },
): Promise<Booking> {
  const db = await getDb();
  const b = await getBooking(bookingId);
  if (!b) throw new BookingError("Booking not found", "not_found");
  if (b.status !== "confirmed") throw new BookingError("Only confirmed bookings can be moved.", "policy");
  const [experience] = await db.select().from(experiences).where(eq(experiences.id, b.experienceId)).limit(1);
  const newStart = new Date(newStartIso);
  const duration = opts.durationMinutes ?? b.durationMinutes;
  if (opts.by === "customer") {
    if (duration !== b.durationMinutes) throw new BookingError("To change the length of your session, contact us.", "policy");
    const deadline = new Date(b.startAt.getTime() - experience.cancellationHours * 3600_000);
    if (new Date() > deadline)
      throw new BookingError(`Changes are possible up to ${experience.cancellationHours} hours before your session.`, "policy");
    if (b.rescheduleCount >= MAX_CUSTOMER_RESCHEDULES)
      throw new BookingError("This booking has already been moved twice — reply to your confirmation email and we'll help.", "policy");
  }
  const previousStart = b.startAt;

  const updated = await db.transaction(async (tx) => {
    await lockResource(tx, b.resourceGroup);
    if (!opts.force) {
      const free = await isSlotFree(tx, {
        experience,
        start: newStart,
        durationMinutes: duration,
        ignoreBookingId: b.id,
        skipNotice: opts.by === "admin",
      });
      if (!free.ok) throw new BookingError("That time isn't available.", "slot_unavailable");
    }
    const [u] = await tx
      .update(bookings)
      .set({
        startAt: newStart,
        endAt: new Date(newStart.getTime() + duration * 60_000),
        durationMinutes: duration,
        rescheduleCount: opts.by === "customer" ? b.rescheduleCount + 1 : b.rescheduleCount,
        reminderSentAt: null,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, b.id))
      .returning();
    await logEvent(tx, b.id, "rescheduled", `Moved from ${fmtDateShort(previousStart)} ${fmtTimeRange(previousStart, b.endAt)} to ${fmtDateShort(newStart)} ${fmtTimeRange(newStart, u.endAt)}`, {
      public: true,
      actor: opts.by,
      data: { from: previousStart.toISOString(), to: newStart.toISOString(), reason: opts.reason },
    });
    return u;
  });

  let final = updated;
  if (b.calBookingUid) {
    try {
      const cal = await calRescheduleBooking(b.calBookingUid, newStart, duration, opts.reason ?? `Rescheduled by ${opts.by}`);
      if (cal?.uid && cal.uid !== b.calBookingUid) {
        [final] = await db.update(bookings).set({ calBookingUid: cal.uid }).where(eq(bookings.id, b.id)).returning();
      }
    } catch (err) {
      await logEvent(db, b.id, "calendar_error", `Couldn't move the Cal.com event — update it manually: ${String(err)}`);
    }
  }
  if (opts.notifyCustomer !== false) await notify.sendBookingRescheduled(b.id, previousStart);
  if (opts.by === "customer") await notify.sendHostBookingAlert(b.id, "rescheduled");
  await notifyWaitlistForDate(b.experienceId, localDateKey(previousStart));
  return final;
}

/* ------------------------------------------------------------------ */
/* Admin operations                                                      */
/* ------------------------------------------------------------------ */

export async function refundBooking(bookingId: string, amountCents: number, reason: string): Promise<Booking> {
  const db = await getDb();
  const b = await getBooking(bookingId);
  if (!b) throw new BookingError("Booking not found", "not_found");
  const remaining = b.amountPaidCents - b.amountRefundedCents;
  const amount = Math.min(remaining, Math.round(amountCents));
  if (amount <= 0) throw new BookingError("Nothing left to refund.", "payment");
  let stripeRefundId: string | null = null;
  if (b.stripePaymentIntentId) {
    const r = await refundPayment({ paymentIntentId: b.stripePaymentIntentId, amountCents: amount, reason, bookingId });
    stripeRefundId = r?.id ?? null;
  } else if (integrations.stripe()) {
    throw new BookingError("No Stripe payment is linked to this booking.", "payment");
  }
  const refunded = b.amountRefundedCents + amount;
  const [u] = await db
    .update(bookings)
    .set({ amountRefundedCents: refunded, paymentStatus: refunded >= b.amountPaidCents ? "refunded" : "partially_refunded", updatedAt: new Date() })
    .where(eq(bookings.id, b.id))
    .returning();
  await db.insert(refunds).values({ bookingId: b.id, amountCents: amount, reason, stripeRefundId, createdBy: "admin" });
  await logEvent(db, b.id, "refunded", `Refunded ${(amount / 100).toFixed(2)} USD${reason ? ` — ${reason}` : ""}`, { public: true, actor: "admin" });
  return u;
}

export async function setBookingStatus(bookingId: string, status: "completed" | "no_show" | "confirmed"): Promise<Booking> {
  const db = await getDb();
  const [u] = await db
    .update(bookings)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(bookings.id, bookingId), inArray(bookings.status, ["confirmed", "completed", "no_show"])))
    .returning();
  if (!u) throw new BookingError("Can't change the status of this booking.", "policy");
  await logEvent(db, bookingId, status, status === "completed" ? "Session completed" : status === "no_show" ? "Marked as no-show" : "Re-opened", {
    actor: "admin",
    public: status === "completed",
  });
  return u;
}

export async function setDeliverable(
  bookingId: string,
  opts: { status: "none" | "in_progress" | "delivered"; url?: string | null; notifyCustomer?: boolean },
): Promise<Booking> {
  const db = await getDb();
  const [u] = await db
    .update(bookings)
    .set({ deliverableStatus: opts.status, deliverableUrl: opts.url ?? null, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId))
    .returning();
  if (!u) throw new BookingError("Booking not found", "not_found");
  const msg =
    opts.status === "delivered" ? "Your track is ready to download" : opts.status === "in_progress" ? "Alex is finishing your track" : "Deliverable reset";
  await logEvent(db, bookingId, "deliverable", msg, { public: opts.status !== "none", actor: "admin" });
  if (opts.status === "delivered" && opts.url && opts.notifyCustomer !== false) await notify.sendDeliverableReady(bookingId);
  return u;
}

/** Admin "Resend confirmation". Stamps confirmationSentAt only when the email actually went out. */
export async function resendConfirmation(bookingId: string): Promise<{ sent: boolean; to: string }> {
  const b = await getBooking(bookingId);
  if (!b) throw new BookingError("Booking not found", "not_found");
  if (b.contactEmail.endsWith("@rawplanet.invalid")) throw new BookingError("This booking has no guest email.", "invalid");
  const status = await notify.tryBookingConfirmation(b.id);
  if (status !== "sent") return { sent: false, to: b.contactEmail };
  const db = await getDb();
  await db.update(bookings).set({ confirmationSentAt: new Date() }).where(eq(bookings.id, b.id));
  await logEvent(db, b.id, "email_sent", "Confirmation email re-sent", { actor: "admin" });
  return { sent: true, to: b.contactEmail };
}

export async function addInternalNote(bookingId: string, note: string): Promise<void> {
  const db = await getDb();
  const text = note.trim().slice(0, 2000);
  if (!text) return;
  await db
    .update(bookings)
    .set({ internalNotes: sql`case when ${bookings.internalNotes} = '' then ${text} else ${bookings.internalNotes} || E'\n\n' || ${text} end`, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId));
  await logEvent(db, bookingId, "note", text, { actor: "admin" });
}

/**
 * Admin-created booking: phone/DM bookings, or mirroring an Airbnb/Viator
 * booking so it shows in reports. Airbnb bookings are already on Google
 * Calendar (Airbnb sync), so they are NOT pushed to Cal.com; everything else is.
 */
export async function createManualBooking(input: {
  experienceId: string;
  start: string;
  durationMinutes: number;
  guests: number;
  contact: { name: string; email: string; phone?: string | null };
  source: BookingSource;
  amountPaidCents?: number;
  externalRef?: string | null;
  notes?: string;
  allowConflicts?: boolean;
  sendConfirmation?: boolean;
  language?: "en" | "es";
  occasion?: string | null;
}): Promise<Booking> {
  const db = await getDb();
  const [experience] = await db.select().from(experiences).where(eq(experiences.id, input.experienceId)).limit(1);
  if (!experience) throw new BookingError("Experience not found", "not_found");
  const start = new Date(input.start);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  const email = input.contact.email?.trim().toLowerCase() || `no-email+${Date.now()}@rawplanet.invalid`;

  const booking = await db.transaction(async (tx) => {
    await lockResource(tx, experience.resourceGroup);
    if (!input.allowConflicts) {
      const free = await isSlotFree(tx, { experience, start, durationMinutes: input.durationMinutes, skipNotice: true });
      if (!free.ok) throw new BookingError(`That time conflicts with another booking or block (${free.reason}).`, "slot_unavailable");
    }
    const customerId = await upsertCustomer(tx, { ...input.contact, email, language: input.language });
    const paid = input.amountPaidCents ?? 0;
    const [b] = await tx
      .insert(bookings)
      .values({
        code: newBookingCode(),
        experienceId: experience.id,
        customerId,
        status: "confirmed",
        paymentStatus: paid > 0 ? "paid" : "not_required",
        source: input.source,
        startAt: start,
        endAt: end,
        durationMinutes: input.durationMinutes,
        guests: input.guests,
        resourceGroup: experience.resourceGroup,
        contactName: input.contact.name,
        contactEmail: email,
        contactPhone: input.contact.phone ?? null,
        language: input.language ?? "en",
        internalNotes: input.notes ?? "",
        occasion: input.occasion ?? null,
        subtotalCents: paid,
        totalCents: paid,
        amountPaidCents: paid,
        externalRef: input.externalRef ?? null,
        manageToken: newToken(),
        confirmedAt: new Date(),
      })
      .returning();
    await logEvent(tx, b.id, "created", `Added manually (${input.source})`, { actor: "admin" });
    return b;
  });

  let final = booking;
  if (experience.calEventTypeId && input.source !== "airbnb") {
    try {
      const cal = await calCreateBooking({
        eventTypeId: experience.calEventTypeId,
        start,
        durationMinutes: input.durationMinutes,
        attendee: { name: booking.contactName, email: booking.contactEmail, phone: booking.contactPhone },
        metadata: { rpBookingId: booking.id, rpCode: booking.code, source: input.source },
      });
      if (cal) [final] = await db.update(bookings).set({ calBookingUid: cal.uid }).where(eq(bookings.id, booking.id)).returning();
    } catch (err) {
      await logEvent(db, booking.id, "calendar_error", `Couldn't add to Cal.com: ${String(err)}`);
    }
  }
  if (input.sendConfirmation && input.contact.email) {
    await notify.sendBookingConfirmation(booking.id);
    await db.update(bookings).set({ confirmationSentAt: new Date() }).where(eq(bookings.id, booking.id));
  }
  return final;
}

/* ------------------------------------------------------------------ */
/* Waitlist                                                              */
/* ------------------------------------------------------------------ */

async function notifyWaitlistForDate(experienceId: string, dateKey: string): Promise<void> {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(waitlist)
      .where(and(eq(waitlist.experienceId, experienceId), eq(waitlist.date, dateKey)));
    for (const w of rows.filter((r) => !r.notifiedAt)) {
      await notify.sendWaitlistOpening(w.id);
      await db.update(waitlist).set({ notifiedAt: new Date() }).where(eq(waitlist.id, w.id));
    }
  } catch (err) {
    console.error("[waitlist] notify failed", err);
  }
}
