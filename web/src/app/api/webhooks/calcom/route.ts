/**
 * POST /api/webhooks/calcom
 * Cal.com webhook (subscribe to BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED).
 * Signed with CALCOM_WEBHOOK_SECRET (HMAC-SHA256 of the raw body, `x-cal-signature-256`).
 * Cal.com has no event id, so idempotency is keyed on a hash of the body.
 */
import { createHash } from "node:crypto";
import { verifyCalSignature } from "@/lib/integrations/calcom";
import { processCalEvent, type CalWebhookBody } from "@/lib/booking/calcom-sync";
import { allowUnsignedInDev, alreadyProcessed, markProcessed } from "../_lib/idempotency";

export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.CALCOM_WEBHOOK_SECRET;
  if (secret) {
    if (!(await verifyCalSignature(raw, req.headers.get("x-cal-signature-256"))))
      return Response.json({ error: "Invalid signature" }, { status: 401 });
  } else if (allowUnsignedInDev(secret)) {
    console.warn("[cal webhook] CALCOM_WEBHOOK_SECRET unset — accepting unsigned event (dev only)");
  } else {
    console.error("[cal webhook] CALCOM_WEBHOOK_SECRET is not set");
    return Response.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let body: CalWebhookBody;
  try {
    body = JSON.parse(raw) as CalWebhookBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !body.triggerEvent) return Response.json({ error: "Not a Cal.com event" }, { status: 400 });

  const id = `cal:${createHash("sha256").update(raw).digest("hex").slice(0, 40)}`;
  if (await alreadyProcessed(id)) return Response.json({ received: true, duplicate: true });

  try {
    const result = await processCalEvent(body);
    await markProcessed(id, "calcom", body.triggerEvent);
    return Response.json({ received: true, result });
  } catch (err) {
    console.error(`[cal webhook] ${body.triggerEvent} failed`, err);
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
