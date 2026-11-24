/** Apply SQL migrations in ./drizzle to DATABASE_URL (or local PGlite). */
import { createDb } from "../src/lib/db";

async function main() {
  if (process.env.DATABASE_URL) {
    const postgres = (await import("postgres")).default;
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(process.env.DATABASE_URL, { max: 1 });
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
    await client.end();
  } else {
    await createDb(); // PGlite migrates itself on open
  }
  console.log("Migrations applied.");
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
