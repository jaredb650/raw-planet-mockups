/**
 * POST /api/webhooks/stripe
 *
 * Subscribe the endpoint to: checkout.session.completed,
 * checkout.session.async_payment_succeeded, checkout.session.async_payment_failed,
 * checkout.session.expired, charge.refunded.
 */
import Stripe from "stripe";
import { processStripeEvent } from "../../_lib/stripe-sync";
import { allowUnsignedInDev, alreadyProcessed, markProcessed } from "../_lib/idempotency";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await req.text();

  let event: Stripe.Event;
  if (secret) {
    const signature = req.headers.get("stripe-signature");
    if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });
    try {
      event = Stripe.webhooks.constructEvent(raw, signature, secret);
    } catch {
      return Response.json({ error: "Invalid signature" }, { status: 400 });
    }
  } else if (allowUnsignedInDev(secret)) {
    try {
      event = JSON.parse(raw) as Stripe.Event;
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!event?.id || !event?.type) return Response.json({ error: "Not a Stripe event" }, { status: 400 });
    console.warn("[stripe webhook] STRIPE_WEBHOOK_SECRET unset — accepting unsigned event (dev only)");
  } else {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET is not set");
    return Response.json({ error: "Webhook not configured" }, { status: 500 });
  }

  if (await alreadyProcessed(event.id)) return Response.json({ received: true, duplicate: true });

  try {
    const result = await processStripeEvent(event);
    await markProcessed(event.id, "stripe", event.type);
    return Response.json({ received: true, result });
  } catch (err) {
    console.error(`[stripe webhook] ${event.type} ${event.id} failed`, err);
    // 500 → Stripe retries with backoff.
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
