import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";

/**
 * Webhook idempotency via the webhook_events table.
 * We record an event only after it was processed successfully, so a failed
 * attempt is retried by the provider; handlers themselves are idempotent, so
 * a rare concurrent duplicate is harmless.
 */
export async function alreadyProcessed(id: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select({ id: webhookEvents.id }).from(webhookEvents).where(eq(webhookEvents.id, id)).limit(1);
  return Boolean(row);
}

export async function markProcessed(id: string, provider: "stripe" | "calcom", type: string): Promise<void> {
  const db = await getDb();
  await db.insert(webhookEvents).values({ id, provider, type }).onConflictDoNothing();
}

/**
 * Local development without a signing secret: accept unsigned deliveries so
 * the flows can be exercised end-to-end. Never in production.
 */
export function allowUnsignedInDev(secret: string | undefined): boolean {
  return !secret && process.env.NODE_ENV !== "production";
}
