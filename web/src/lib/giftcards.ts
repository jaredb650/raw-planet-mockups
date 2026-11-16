/**
 * Gift card service — the only place gift card state changes (besides the
 * booking service redeeming / refunding balances).
 *
 * Lifecycle:
 *   createGiftCardPurchase ─► pending_payment ─► Stripe paid ─► fulfillGiftCard ─► active ─► depleted
 *                                    └─ checkout expired ─► void
 *   issueGiftCard (admin comp) ─► active
 *   voidGiftCard / adjustGiftCardBalance (admin)
 *
 * Every balance change writes a row to gift_card_transactions.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { giftCards, giftCardTransactions, type GiftCard } from "@/lib/db/schema";
import { integrations, siteUrl } from "@/lib/config";
import { newGiftCardCode, normalizeCode } from "@/lib/ids";
import { formatMoney } from "@/lib/money";
import { fromLocal, localDateKey } from "@/lib/time";
import { createCheckoutSession } from "@/lib/integrations/stripe";
import * as notify from "@/lib/email/notify";

export class GiftCardError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "invalid" | "state" = "invalid",
  ) {
    super(message);
  }
}

export const GIFT_CARD_MIN_CENTS = 2_500;
export const GIFT_CARD_MAX_CENTS = 200_000;
/** Hour (New York time) scheduled gift cards go out on their delivery date. */
const DELIVERY_HOUR = "09:00";

/* ------------------------------------------------------------------ */
/* Signed links (test checkout + thank-you page)                       */
/* ------------------------------------------------------------------ */

function signingSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be set in production");
  return s ?? "dev-only-insecure-secret-change-me-please-32b";
}

/** Token that lets the purchaser view their card on the thank-you page / pay on the test page. */
export function giftCardLinkToken(giftCardId: string): string {
  return createHmac("sha256", signingSecret()).update(`gift-card:${giftCardId}`).digest("base64url").slice(0, 32);
}

export function verifyGiftCardLinkToken(giftCardId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = giftCardLinkToken(giftCardId);
  if (expected.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

export function giftCardSuccessPath(giftCardId: string): string {
  return `/gift-cards/success?id=${encodeURIComponent(giftCardId)}&k=${giftCardLinkToken(giftCardId)}`;
}

/* ------------------------------------------------------------------ */
/* Reads                                                                */
/* ------------------------------------------------------------------ */

export async function getGiftCard(id: string): Promise<GiftCard | undefined> {
  const db = await getDb();
  const [row] = await db.select().from(giftCards).where(eq(giftCards.id, id)).limit(1);
  return row;
}

export async function getGiftCardBalance(code: string): Promise<{ balanceCents: number; status: string } | null> {
  const clean = normalizeCode(code ?? "");
  if (!clean || clean.length > 40) return null;
  const db = await getDb();
  const [row] = await db
    .select({ balanceCents: giftCards.balanceCents, status: giftCards.status })
    .from(giftCards)
    .where(eq(giftCards.code, clean))
    .limit(1);
  return row ?? null;
}

/* ------------------------------------------------------------------ */
/* Purchase                                                              */
/* ------------------------------------------------------------------ */

export type GiftCardPurchaseInput = {
  amountCents: number;
  purchaserName: string;
  purchaserEmail: string;
  recipientName?: string | null;
  recipientEmail?: string | null;
  message?: string | null;
  /** Business-local date "YYYY-MM-DD" to email the recipient (omit/today = immediately). */
  deliverOn?: string | null;
  language?: "en" | "es";
};

export async function createGiftCardPurchase(input: GiftCardPurchaseInput): Promise<{ url: string }> {
  if (!integrations.stripe() && !integrations.testCheckout()) throw new GiftCardError("Online payments aren't set up yet. Please contact us.");
  const amount = Math.round(input.amountCents);
  if (!Number.isInteger(amount) || amount < GIFT_CARD_MIN_CENTS || amount > GIFT_CARD_MAX_CENTS)
    throw new GiftCardError(`Choose an amount between ${formatMoney(GIFT_CARD_MIN_CENTS)} and ${formatMoney(GIFT_CARD_MAX_CENTS)}.`);
  const purchaserEmail = input.purchaserEmail.trim().toLowerCase();
  const recipientEmail = input.recipientEmail?.trim().toLowerCase() || null;

  let deliverAt: Date | null = null;
  if (input.deliverOn) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.deliverOn)) throw new GiftCardError("Pick a valid delivery date.");
    const today = localDateKey(new Date());
    if (input.deliverOn > today) {
      if (!recipientEmail) throw new GiftCardError("Add the recipient's email so we can deliver it on that date.");
      deliverAt = fromLocal(input.deliverOn, DELIVERY_HOUR);
      if (deliverAt.getTime() - Date.now() > 366 * 86400_000) throw new GiftCardError("Delivery date must be within a year.");
    }
  }

  const db = await getDb();
  let card: GiftCard | undefined;
  for (let attempt = 0; attempt < 5 && !card; attempt++) {
    const [row] = await db
      .insert(giftCards)
      .values({
        code: newGiftCardCode(),
        initialCents: amount,
        balanceCents: amount,
        status: "pending_payment",
        purchaserName: input.purchaserName.trim().slice(0, 120),
        purchaserEmail,
        recipientName: input.recipientName?.trim().slice(0, 120) || null,
        recipientEmail,
        message: input.message?.trim().slice(0, 1000) || null,
        deliverAt,
        language: input.language ?? "en",
      })
      .onConflictDoNothing({ target: giftCards.code })
      .returning();
    card = row;
  }
  if (!card) throw new Error("Couldn't allocate a gift card code");

  if (!integrations.stripe()) {
    return { url: siteUrl(`/checkout/test/gift_card/${card.id}?t=${giftCardLinkToken(card.id)}`) };
  }
  const forWhom = card.recipientName ? ` for ${card.recipientName}` : "";
  const session = await createCheckoutSession({
    kind: "gift_card",
    refId: card.id,
    email: purchaserEmail,
    description: `Raw Planet gift card ${formatMoney(amount)}${forWhom}`,
    lines: [
      {
        name: `Raw Planet gift card — ${formatMoney(amount)}`,
        description: card.recipientName ? `For ${card.recipientName}` : "Good for any session",
        amountCents: amount,
      },
    ],
    successUrl: siteUrl(`${giftCardSuccessPath(card.id)}&session_id={CHECKOUT_SESSION_ID}`),
    cancelUrl: siteUrl(`/gift-cards?cancelled=1`),
    expiresInMinutes: 60,
  });
  await db.update(giftCards).set({ stripeCheckoutSessionId: session.id }).where(eq(giftCards.id, card.id));
  return { url: session.url };
}

/**
 * Payment received → activate. Idempotent: calling it again for an active
 * card returns the card without re-sending emails.
 */
export async function fulfillGiftCard(
  giftCardId: string,
  payment: { amountPaidCents: number; paymentIntentId?: string | null; checkoutSessionId?: string | null },
): Promise<GiftCard> {
  const db = await getDb();
  const activated = await db.transaction(async (tx) => {
    const [card] = await tx
      .update(giftCards)
      .set({
        status: "active",
        stripePaymentIntentId: payment.paymentIntentId ?? null,
        ...(payment.checkoutSessionId ? { stripeCheckoutSessionId: payment.checkoutSessionId } : {}),
      })
      .where(and(eq(giftCards.id, giftCardId), eq(giftCards.status, "pending_payment")))
      .returning();
    if (!card) return null;
    await tx.insert(giftCardTransactions).values({
      giftCardId: card.id,
      amountCents: card.initialCents,
      note:
        payment.amountPaidCents === card.initialCents
          ? "Purchased"
          : `Purchased (paid ${formatMoney(payment.amountPaidCents)} for ${formatMoney(card.initialCents)} — check)`,
    });
    return card;
  });

  if (!activated) {
    const existing = await getGiftCard(giftCardId);
    if (!existing) throw new GiftCardError("Gift card not found", "not_found");
    if (existing.status === "void") {
      // Paid after the checkout was marked expired/voided: reactivate rather than lose the money.
      if (payment.amountPaidCents > 0 && existing.balanceCents === existing.initialCents && !existing.issuedByAdmin) {
        await db.update(giftCards).set({ status: "pending_payment" }).where(and(eq(giftCards.id, giftCardId), eq(giftCards.status, "void")));
        return fulfillGiftCard(giftCardId, payment);
      }
    }
    return existing;
  }

  const sendRecipientNow = Boolean(activated.recipientEmail) && (!activated.deliverAt || activated.deliverAt <= new Date());
  await notify.sendGiftCardEmails(activated.id, { purchaserReceipt: true, recipient: sendRecipientNow });
  // Without a recipient email the purchaser's receipt carries the card, so it's delivered now.
  if (sendRecipientNow || !activated.recipientEmail) {
    const [u] = await db.update(giftCards).set({ deliveredAt: new Date() }).where(eq(giftCards.id, activated.id)).returning();
    return u;
  }
  return activated;
}

/** Checkout abandoned / expired before payment → void the unpaid card. */
export async function expireGiftCardPurchase(giftCardId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(giftCards)
    .set({ status: "void" })
    .where(and(eq(giftCards.id, giftCardId), eq(giftCards.status, "pending_payment")));
}

/* ------------------------------------------------------------------ */
/* Admin                                                                 */
/* ------------------------------------------------------------------ */

export async function issueGiftCard(input: {
  amountCents: number;
  purchaserName: string;
  purchaserEmail: string;
  recipientName?: string;
  recipientEmail?: string;
  message?: string;
  sendEmail?: boolean;
}): Promise<GiftCard> {
  const amount = Math.round(input.amountCents);
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) throw new GiftCardError("Enter a positive amount.");
  const db = await getDb();
  let card: GiftCard | undefined;
  for (let attempt = 0; attempt < 5 && !card; attempt++) {
    card = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(giftCards)
        .values({
          code: newGiftCardCode(),
          initialCents: amount,
          balanceCents: amount,
          status: "active",
          purchaserName: input.purchaserName.trim(),
          purchaserEmail: input.purchaserEmail.trim().toLowerCase(),
          recipientName: input.recipientName?.trim() || null,
          recipientEmail: input.recipientEmail?.trim().toLowerCase() || null,
          message: input.message?.trim() || null,
          issuedByAdmin: true,
        })
        .onConflictDoNothing({ target: giftCards.code })
        .returning();
      if (!row) return undefined;
      await tx.insert(giftCardTransactions).values({ giftCardId: row.id, amountCents: amount, note: "Issued by admin" });
      return row;
    });
  }
  if (!card) throw new Error("Couldn't allocate a gift card code");

  if (input.sendEmail) {
    const toRecipient = Boolean(card.recipientEmail);
    await notify.sendGiftCardEmails(card.id, { purchaserReceipt: !toRecipient, recipient: toRecipient });
    [card] = await db.update(giftCards).set({ deliveredAt: new Date() }).where(eq(giftCards.id, card.id)).returning();
  }
  return card;
}

export async function voidGiftCard(id: string, reason: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [card] = await tx.select().from(giftCards).where(eq(giftCards.id, id)).for("update").limit(1);
    if (!card) throw new GiftCardError("Gift card not found", "not_found");
    if (card.status === "void") return;
    await tx.update(giftCards).set({ status: "void", balanceCents: 0 }).where(eq(giftCards.id, id));
    await tx.insert(giftCardTransactions).values({
      giftCardId: id,
      amountCents: -card.balanceCents,
      note: `Voided${reason.trim() ? `: ${reason.trim().slice(0, 300)}` : ""}`,
    });
  });
}

export async function adjustGiftCardBalance(id: string, deltaCents: number, note: string): Promise<GiftCard> {
  const delta = Math.round(deltaCents);
  if (!Number.isInteger(delta) || delta === 0) throw new GiftCardError("Enter a non-zero amount.");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [card] = await tx.select().from(giftCards).where(eq(giftCards.id, id)).for("update").limit(1);
    if (!card) throw new GiftCardError("Gift card not found", "not_found");
    if (card.status === "void" || card.status === "pending_payment")
      throw new GiftCardError(card.status === "void" ? "This gift card is void." : "This gift card hasn't been paid for yet.", "state");
    const balance = card.balanceCents + delta;
    if (balance < 0) throw new GiftCardError(`The balance is only ${formatMoney(card.balanceCents)}.`);
    const [u] = await tx
      .update(giftCards)
      .set({ balanceCents: balance, status: balance === 0 ? "depleted" : "active" })
      .where(eq(giftCards.id, id))
      .returning();
    await tx.insert(giftCardTransactions).values({ giftCardId: id, amountCents: delta, note: note.trim().slice(0, 500) || "Adjusted by admin" });
    return u;
  });
}
