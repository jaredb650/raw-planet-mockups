/**
 * Stripe → our state. Used by the webhook and, as a fallback when the
 * webhook is slow, by the confirmation page / status poll (which look up the
 * Checkout Session directly).
 */
import "server-only";
import type Stripe from "stripe";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bookings, giftCards, giftCardTransactions, refunds, type Booking, type GiftCard } from "@/lib/db/schema";
import { integrations } from "@/lib/config";
import { stripe } from "@/lib/integrations/stripe";
import { expireBooking, fulfillBooking, getBooking, logEvent } from "@/lib/booking/service";
import { expireGiftCardPurchase, fulfillGiftCard, getGiftCard } from "@/lib/giftcards";
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
    if (b.status === "confirmed" || b.status === "completed") return `booking already ${b.status}`;
    if (!PAYABLE.includes(b.status)) {
      await fulfillBooking(refId, payment);
      return `booking ${b.status} — late payment refunded`;
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
 * Reconcile Stripe charge refunds into `refunds` and `bookings.amountRefundedCents`.
 * Uses a row lock + `refunds_stripe_id_uidx` (`ON CONFLICT DO NOTHING`) so concurrent
 * webhooks and app-initiated refunds can never double-count or drop orphaned Stripe refunds.
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

  const [bookingRef] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.stripePaymentIntentId, paymentIntentId))
    .limit(1);
  if (!bookingRef) {
    const [card] = await db.select().from(giftCards).where(eq(giftCards.stripePaymentIntentId, paymentIntentId)).limit(1);
    if (card) return syncGiftCardRefund(card, charge);
    return "no matching booking";
  }

  const succeeded = stripeRefunds.filter((r) => r.status !== "failed" && r.status !== "canceled");

  const outcome = await db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingRef.id)).for("update").limit(1);
    if (!booking) return { added: 0, refundIds: [] as string[] };

    let added = 0;
    const insertedIds: string[] = [];

    if (succeeded.length) {
      for (const r of succeeded) {
        const [ins] = await tx
          .insert(refunds)
          .values({
            bookingId: booking.id,
            amountCents: r.amount,
            reason: r.metadata?.bookingId ? "Refunded (reconciled from Stripe)" : "Refunded in Stripe dashboard",
            stripeRefundId: r.id,
            createdBy: "admin",
          })
          .onConflictDoNothing({ target: refunds.stripeRefundId })
          .returning({ id: refunds.id });
        if (ins) {
          added += r.amount;
          insertedIds.push(r.id);
        }
      }
    } else if (!stripeRefunds.length && charge.amount_refunded > booking.amountRefundedCents) {
      // Unexpanded payload without API access: trust the charge total.
      added = charge.amount_refunded - booking.amountRefundedCents;
      await tx.insert(refunds).values({
        bookingId: booking.id,
        amountCents: added,
        reason: "Refunded in Stripe dashboard",
        createdBy: "admin",
      });
    }

    if (added <= 0) return { added: 0, refundIds: [] as string[] };

    // Recompute authoritative card refund total from the refunds table (bounded by amountPaidCents).
    const [sumRow] = await tx
      .select({ total: sql<number>`coalesce(sum(${refunds.amountCents} - ${refunds.giftCardCents}), 0)::int` })
      .from(refunds)
      .where(eq(refunds.bookingId, booking.id));
    const refunded = Math.min(booking.amountPaidCents, Math.max(booking.amountRefundedCents, sumRow?.total ?? booking.amountRefundedCents + added));

    await tx
      .update(bookings)
      .set({
        amountRefundedCents: refunded,
        paymentStatus: refunded >= booking.amountPaidCents ? "refunded" : "partially_refunded",
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id));

    await logEvent(tx, booking.id, "refunded", `Refunded ${formatMoney(added, { showCents: true })} to your card`, {
      public: true,
      actor: "admin",
      data: { source: "stripe_dashboard", refundIds: insertedIds },
    });
    return { added, refundIds: insertedIds };
  });

  if (outcome.added <= 0) return "no new refunds";
  return `recorded ${outcome.added} cents`;
}

async function syncGiftCardRefund(cardRef: GiftCard, charge: Stripe.Charge): Promise<string> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [card] = await tx.select().from(giftCards).where(eq(giftCards.id, cardRef.id)).for("update").limit(1);
    if (!card || card.status === "void") return "gift card already void";

    if (charge.refunded) {
      const deducted = card.balanceCents;
      await tx.update(giftCards).set({ status: "void", balanceCents: 0 }).where(eq(giftCards.id, card.id));
      await tx.insert(giftCardTransactions).values({
        giftCardId: card.id,
        amountCents: -deducted,
        note:
          deducted === card.initialCents
            ? "Voided: payment refunded in Stripe"
            : `Voided: full Stripe refund after ${formatMoney(card.initialCents - deducted)} already spent — check`,
      });
      return "gift card voided";
    }

    // Partial Stripe refund: deduct any newly refunded amount not yet reflected in Stripe-refund transactions.
    const [prev] = await tx
      .select({
        refunded: sql<number>`coalesce(sum(case when ${giftCardTransactions.note} like 'Stripe refund%' then -${giftCardTransactions.amountCents} else 0 end), 0)::int`,
      })
      .from(giftCardTransactions)
      .where(eq(giftCardTransactions.giftCardId, card.id));
    const alreadyDeducted = prev?.refunded ?? 0;
    const delta = Math.max(0, charge.amount_refunded - alreadyDeducted);
    if (delta <= 0) return "gift card refund already recorded";

    const deduct = Math.min(card.balanceCents, delta);
    const nextBalance = card.balanceCents - deduct;
    await tx
      .update(giftCards)
      .set({ balanceCents: nextBalance, status: nextBalance === 0 ? "depleted" : card.status })
      .where(eq(giftCards.id, card.id));
    await tx.insert(giftCardTransactions).values({
      giftCardId: card.id,
      amountCents: -deduct,
      note:
        deduct === delta
          ? `Stripe refund (${formatMoney(delta, { showCents: true })})`
          : `Stripe refund (${formatMoney(delta, { showCents: true })}; only ${formatMoney(deduct, { showCents: true })} remained — check)`,
    });
    return `gift card reduced by ${deduct} cents`;
  });
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
  if (!integrations.stripe() || (booking.status !== "pending_payment" && booking.status !== "expired")) return booking;
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
  if (!integrations.stripe()) return card;
  if (card.status !== "pending_payment" && !(card.status === "void" && !card.stripePaymentIntentId)) return card;
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
