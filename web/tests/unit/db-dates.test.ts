import type { Sql } from "postgres";
import { expect, test, vi } from "vitest";
import { createDb } from "@/lib/db";

// postgres() connects lazily, so no database is needed here.
test("postgres-js client serializes raw Dates in sql templates", async () => {
  vi.stubEnv("DATABASE_URL", "postgres://u:p@127.0.0.1:1/x");
  const { $client } = (await createDb()) as unknown as { $client: Sql };
  const serialize = $client.options.serializers[1184];
  expect(serialize(new Date("2026-10-01T04:00:00Z"))).toBe("2026-10-01T04:00:00.000Z");
  expect(serialize("2026-10-01T04:00:00.000Z")).toBe("2026-10-01T04:00:00.000Z");
  await $client.end();
  vi.unstubAllEnvs();
});
