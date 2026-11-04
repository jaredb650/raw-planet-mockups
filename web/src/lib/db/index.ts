/**
 * Database client.
 *
 * - Production / staging: set DATABASE_URL (Neon, Supabase, RDS… any Postgres).
 * - Local dev: no DATABASE_URL → embedded PGlite (real Postgres compiled to WASM)
 *   persisted under ./.data/pglite, migrated automatically on first use.
 */
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;
/** Transaction handle (same query API as `db`). */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

type GlobalDb = { __rpDb?: Promise<DB> };
const g = globalThis as unknown as GlobalDb;

async function create(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { max: Number(process.env.DATABASE_POOL_MAX ?? 5), prepare: false });
    return drizzlePg(client, { schema });
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzleLite } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = process.env.PGLITE_DIR ?? ".data/pglite";
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const lite = drizzleLite(client, { schema });
  await migrate(lite, { migrationsFolder: "drizzle" });
  // The query-builder API is identical; only the driver differs.
  return lite as unknown as DB;
}

/** Exposed for scripts (seed, migrate) that run outside Next. */
export const createDb = create;

/** Lazily-initialised shared DB handle (survives dev hot reloads). */
export function getDb(): Promise<DB> {
  if (!g.__rpDb) g.__rpDb = create();
  return g.__rpDb;
}

export { schema };
