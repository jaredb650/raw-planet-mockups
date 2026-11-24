/**
 * End-to-end tests for the guest booking flow.
 *
 * Runs against an already-running app (no webServer: PGlite is single-process,
 * so the dev server must be the only thing touching the database):
 *   npx next dev -p 3300        # in one terminal, with STRIPE_SECRET_KEY unset
 *   E2E_BASE_URL=http://localhost:3300 npx playwright test
 *
 * Without Stripe keys checkout goes to /checkout/test/..., which these tests use.
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  // Output lives under .data/ (git-ignored) so test runs never dirty the tree.
  outputDir: ".data/e2e-results",
  fullyParallel: false,
  workers: 1, // tests book real slots in one shared database
  retries: process.env.CI ? 1 : 0,
  // Generous: the dev server compiles routes on first hit and PGlite serialises queries.
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3300",
    trace: "retain-on-failure",
    navigationTimeout: 60_000,
    screenshot: "only-on-failure",
    timezoneId: "America/New_York",
    locale: "en-US",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, grepInvert: /@mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
});
