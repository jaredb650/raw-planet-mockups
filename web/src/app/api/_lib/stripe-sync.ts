/**
 * Stripe → our state. Used by the webhook and, as a fallback when the
 * webhook is slow, by the confirmation page / status poll (which look up the
 * Checkout Session directly).
 */
import "server-only";
import type Stripe from "stripe";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bookings, giftCards, refunds, type Booking, type GiftCard } from "@/lib/db/schema";
import { integrations } from "@/lib/config";
import { stripe } from "@/lib/integrations/stripe";
import { expireBooking, fulfillBooking, getBooking, logEvent } from "@/lib/booking/service";
import { expireGiftCardPurchase, fulfillGiftCard, getGiftCard, voidGiftCard } from "@/lib/giftcards";
import { formatMoney } from "@/lib/money";

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

/** Statuses a payment may still confirm. Anything else (cancelled, completed…) must not be resurrected. */
const PAYABLE: Booking["status"][] = ["pending_payment", "expired"];

async function completeSession(session: Stripe.Checkout.Session): Promise<string> {
  const kind = session.metadata?.kind;
  const refId = session.metadata?.refId ?? session.client_reference_id;
  if (!refId) return "no refId";
  const payment = {
    amountPaidCents: session.amount_total ?? 0,
    paymentIntentId: idOf(session.payment_intent),
    checkoutSessionId: session.id,
  };
  if (kind === "booking") {
    const b = await getBooking(refId);
    if (!b) return "booking not found";
    if (!PAYABLE.includes(b.status)) {
      if (b.status !== "confirmed" && b.status !== "completed") {
        await logEvent(await getDb(), b.id, "payment_warning", `Payment ${payment.paymentIntentId ?? session.id} arrived for a ${b.status} booking — refund it in Stripe if needed`);
      }
      return `booking already ${b.status}`;
    }
    await fulfillBooking(refId, payment);
    return "booking fulfilled";
  }
  if (kind === "gift_card") {
    await fulfillGiftCard(refId, payment);
    return "gift card fulfilled";
  }
  return `ignored kind ${kind}`;
}

async function expireSession(session: Stripe.Checkout.Session, reason: string): Promise<string> {
  const kind = session.metadata?.kind;
  const refId = session.metadata?.refId ?? session.client_reference_id;
  if (!refId) return "no refId";
  if (kind === "booking") {
    await expireBooking(refId, reason);
    return "booking expired";
  }
  if (kind === "gift_card") {
    await expireGiftCardPurchase(refId);
    return "gift card voided";
  }
  return `ignored kind ${kind}`;
}

/**
 * Refunds issued outside our app (Stripe dashboard). Refunds we create are
 * recorded by the booking service with their stripeRefundId and carry
 * metadata.bookingId, so they're skipped here to avoid double counting.
 */
async function syncChargeRefunds(charge: Stripe.Charge): Promise<string> {
  const paymentIntentId = idOf(charge.payment_intent);
  if (!paymentIntentId) return "no payment intent";
  const db = await getDb();

  let stripeRefunds: Stripe.Refund[] = charge.refunds?.data ?? [];
  if ((!charge.refunds || charge.refunds.has_more) && integrations.stripe()) {
    stripeRefunds = [];
    for await (const r of stripe().refunds.list({ charge: charge.id, limit: 100 })) stripeRefunds.push(r);
  }

  const [booking] = await db.select().from(bookings).where(eq(bookings.stripePaymentIntentId, paymentIntentId)).limit(1);
  if (!booking) {
    const [card] = await db.select().from(giftCards).where(eq(giftCards.stripePaymentIntentId, paymentIntentId)).limit(1);
    if (card) return syncGiftCardRefund(card, charge);
    return "no matching booking";
  }

  const succeeded = stripeRefunds.filter((r) => r.status !== "failed" && r.status !== "canceled");
  const ids = succeeded.map((r) => r.id);
  const known = ids.length
    ? new Set((await db.select({ id: refunds.stripeRefundId }).from(refunds).where(inArray(refunds.stripeRefundId, ids))).map((r) => r.id))
    : new Set<string>();
  const external = succeeded.filter((r) => !known.has(r.id) && !r.metadata?.bookingId);

  let added = 0;
  if (external.length) {
    for (const r of external) {
      await db.insert(refunds).values({
        bookingId: booking.id,
        amountCents: r.amount,
        reason: "Refunded in Stripe dashboard",
        stripeRefundId: r.id,
        createdBy: "admin",
      });
      added += r.amount;
    }
  } else if (!stripeRefunds.length && charge.amount_refunded > booking.amountRefundedCents) {
    // No refund list available (e.g. unexpanded payload without API access): trust the charge total.
    added = charge.amount_refunded - booking.amountRefundedCents;
    await db.insert(refunds).values({ bookingId: booking.id, amountCents: added, reason: "Refunded in Stripe dashboard", createdBy: "admin" });
  }
  if (added <= 0) return "no new refunds";

  const refunded = Math.min(booking.amountPaidCents, booking.amountRefundedCents + added);
  await db
    .update(bookings)
    .set({
      amountRefundedCents: refunded,
      paymentStatus: refunded >= booking.amountPaidCents ? "refunded" : "partially_refunded",
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, booking.id));
  await logEvent(db, booking.id, "refunded", `Refunded ${formatMoney(added, { showCents: true })} to your card`, {
    public: true,
    actor: "admin",
    data: { source: "stripe_dashboard", refundIds: external.map((r) => r.id) },
  });
  return `recorded ${added} cents`;
}

async function syncGiftCardRefund(card: GiftCard, charge: Stripe.Charge): Promise<string> {
  // A fully refunded, unused gift card is cancelled; partial refunds are left for the admin to review.
  if (charge.refunded && card.status === "active" && card.balanceCents === card.initialCents) {
    await voidGiftCard(card.id, "Payment refunded in Stripe");
    return "gift card voided";
  }
  return "gift card refund noted";
}

export async function processStripeEvent(event: Stripe.Event): Promise<string> {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      if (s.payment_status !== "paid") return "awaiting async payment";
      return completeSession(s);
    }
    case "checkout.session.async_payment_succeeded":
      return completeSession(event.data.object);
    case "checkout.session.async_payment_failed":
      return expireSession(event.data.object, "Payment failed");
    case "checkout.session.expired":
      return expireSession(event.data.object, "Checkout expired");
    case "charge.refunded":
      return syncChargeRefunds(event.data.object);
    default:
      return `unhandled ${event.type}`;
  }
}

/**
 * Webhook-independent confirmation: if Stripe says the booking's Checkout
 * Session is paid, fulfil now. Safe to call repeatedly (fulfillBooking is
 * idempotent) and a no-op when Stripe isn't configured.
 */
export async function reconcileBookingPayment(booking: Booking, sessionId?: string | null): Promise<Booking> {
  if (!integrations.stripe() || booking.status !== "pending_payment") return booking;
  const sid = booking.stripeCheckoutSessionId;
  if (!sid || (sessionId && sessionId !== sid)) return booking;
  try {
    const s = await stripe().checkout.sessions.retrieve(sid);
    if (s.status === "complete" && s.payment_status === "paid" && s.metadata?.refId === booking.id) {
      await completeSession(s);
      return (await getBooking(booking.id)) ?? booking;
    }
  } catch (err) {
    console.warn("[stripe] reconcile booking failed", err);
  }
  return booking;
}

export async function reconcileGiftCardPayment(card: GiftCard, sessionId?: string | null): Promise<GiftCard> {
  if (!integrations.stripe() || card.status !== "pending_payment") return card;
  const sid = card.stripeCheckoutSessionId;
  if (!sid || (sessionId && sessionId !== sid)) return card;
  try {
    const s = await stripe().checkout.sessions.retrieve(sid);
    if (s.status === "complete" && s.payment_status === "paid" && s.metadata?.refId === card.id) {
      await completeSession(s);
      return (await getGiftCard(card.id)) ?? card;
    }
  } catch (err) {
    console.warn("[stripe] reconcile gift card failed", err);
  }
  return card;
}
