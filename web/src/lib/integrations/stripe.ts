/**
 * Stripe adapter. When STRIPE_SECRET_KEY is unset the app uses a built-in
 * "test checkout" page (/checkout/test/[kind]/[id]) so the full flow can be
 * exercised locally — it is disabled automatically once Stripe is configured.
 */
import "server-only";
import Stripe from "stripe";
import { integrations } from "@/lib/config";

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!integrations.stripe()) throw new Error("Stripe is not configured (STRIPE_SECRET_KEY).");
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY!, { appInfo: { name: "Raw Planet Experiences" } });
  return client;
}

export type CheckoutLine = { name: string; description?: string; amountCents: number; quantity?: number };

export async function createCheckoutSession(opts: {
  kind: "booking" | "gift_card" | "event";
  refId: string;
  email: string;
  lines: CheckoutLine[];
  successUrl: string;
  cancelUrl: string;
  expiresInMinutes: number;
  description: string;
}): Promise<{ id: string; url: string }> {
  const s = await stripe().checkout.sessions.create({
    mode: "payment",
    submit_type: opts.kind === "booking" ? "book" : "pay",
    customer_email: opts.email,
    client_reference_id: opts.refId,
    line_items: opts.lines
      .filter((l) => l.amountCents > 0)
      .map((l) => ({
        quantity: l.quantity ?? 1,
        price_data: {
          currency: "usd",
          unit_amount: l.amountCents,
          product_data: { name: l.name, ...(l.description ? { description: l.description } : {}) },
        },
      })),
    metadata: { kind: opts.kind, refId: opts.refId },
    payment_intent_data: {
      description: opts.description,
      metadata: { kind: opts.kind, refId: opts.refId },
    },
    expires_at: Math.floor(Date.now() / 1000) + Math.max(30, opts.expiresInMinutes) * 60,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    allow_promotion_codes: false,
  });
  return { id: s.id, url: s.url! };
}

export async function expireCheckoutSession(id: string | null | undefined): Promise<void> {
  if (!id || !integrations.stripe()) return;
  try {
    await stripe().checkout.sessions.expire(id);
  } catch {
    /* already completed/expired */
  }
}

export async function refundPayment(opts: {
  paymentIntentId: string;
  amountCents: number;
  reason?: string;
  bookingId?: string;
}): Promise<{ id: string } | null> {
  if (!integrations.stripe() || opts.amountCents <= 0) return null;
  const r = await stripe().refunds.create({
    payment_intent: opts.paymentIntentId,
    amount: opts.amountCents,
    reason: "requested_by_customer",
    metadata: { note: (opts.reason ?? "").slice(0, 400), bookingId: opts.bookingId ?? "" },
  });
  return { id: r.id };
}
