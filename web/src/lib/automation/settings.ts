/**
 * Tiny key/value helpers over the `settings` table for automation state
 * (calendar feed token, cron lease, last digest date, host phone).
 */
import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1);
  return row ? (row.value as T) : undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

/** Non-empty trimmed string setting, else null. */
export async function getStringSetting(key: string): Promise<string | null> {
  const v = await getSetting<unknown>(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Atomically take a time-limited lease (e.g. so two overlapping cron runs
 * don't both send reminders). Returns false when someone else holds it.
 */
export async function acquireLease(key: string, ttlMs: number, now = new Date()): Promise<boolean> {
  const db = await getDb();
  const until = new Date(now.getTime() + ttlMs).toISOString();
  const rows = await db.execute(sql`
    insert into settings (key, value, updated_at)
    values (${key}, ${JSON.stringify({ until })}::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()
    where (settings.value->>'until')::timestamptz < ${now.toISOString()}::timestamptz
    returning key`);
  return rowCount(rows) > 0;
}

export async function releaseLease(key: string): Promise<void> {
  const db = await getDb();
  await db.delete(settings).where(eq(settings.key, key));
}

/** postgres-js returns an array; PGlite returns { rows }. */
function rowCount(res: unknown): number {
  if (Array.isArray(res)) return res.length;
  const r = res as { rows?: unknown[] } | null;
  return r?.rows?.length ?? 0;
}
