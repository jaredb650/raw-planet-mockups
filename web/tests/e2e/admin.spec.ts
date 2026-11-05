/**
 * Admin flows in a real browser. Needs the same running app as booking.spec.ts.
 * Set E2E_ADMIN_PASSWORD if the app uses a non-default password, and E2E_SHOTS
 * to a folder to also capture every new screen.
 */
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "rawplanet";
const SHOTS = process.env.E2E_SHOTS;

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByLabel("Password").press("Enter");
  await expect(page).toHaveURL(/\/admin$/);
}

async function firstBookingOnToday(page: Page) {
  await page.goto("/admin");
  return page.getByRole("button", { name: /^Check in/ }).first();
}

test.describe("admin", () => {
  test.beforeEach(async ({ page }) => login(page));

  test("search opens from the keyboard, finds a page, and restores focus", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const box = page.getByRole("combobox", { name: /Search pages/ });
    await expect(box).toBeFocused();
    await box.fill("reports");
    await expect(page.getByRole("option", { name: /Reports/ }).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(box).toBeHidden();
    await page.keyboard.press("Meta+k");
    await page.getByRole("combobox", { name: /Search pages/ }).fill("reports");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/admin\/reports/);
  });

  test("check in a guest, undo it, and see them on the manifest", async ({ page }) => {
    const button = await firstBookingOnToday(page);
    test.skip((await button.count()) === 0, "No confirmed session today in New York");
    await button.click();
    await expect(page.getByRole("button", { name: /^Undo check-in/ }).first()).toBeVisible();
    await page.getByRole("link", { name: /manifest/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/manifest/);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await page.goto("/admin");
    await page.getByRole("button", { name: /^Undo check-in/ }).first().click();
    await expect(page.getByRole("button", { name: /^Check in/ }).first()).toBeVisible();
  });

  test("a guest signs the waiver and it appears on the booking", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/admin/bookings");
    await page.locator('a[href^="/admin/bookings/"]:not([href$="/new"])').first().click();
    await page.getByRole("button", { name: "Copy signing link" }).click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/\/waiver\/.+\?t=/);
    const signer = `E2E Signer ${Date.now()}`;
    const url = new URL(link);
    const guest = await context.newPage();
    await guest.goto(url.pathname + url.search);
    await guest.getByLabel(/full name/i).first().fill(signer);
    await guest.locator('input[name="agree"]').check();
    const [res] = await Promise.all([
      guest.waitForResponse((r) => r.url().includes("/api/waivers")),
      guest.locator('button[type="submit"]').click(),
    ]);
    expect(res.status(), await res.text()).toBe(201);
    await guest.close();
    await page.reload();
    await expect(page.getByText(signer).first()).toBeVisible();
  });

  test("a smart pricing rule changes the price guests see, then can be removed", async ({ page }) => {
    await page.goto("/admin/pricing");
    const name = `E2E off-peak ${Date.now()}`;
    await page.getByLabel("Name (only you see it)").first().fill(name);
    await page.getByLabel("Price change (%)").first().fill("-20");
    await page.locator('input[name="active"]').first().check();
    await page.getByRole("button", { name: "Create rule" }).click();
    await expect(page.getByText(name).first()).toBeVisible();

    await page.goto("/book?experience=music-production");
    await expect(page.getByText("Off-peak").first()).toBeVisible();

    await page.goto("/admin/pricing");
    const row = page.getByRole("listitem").filter({ hasText: name });
    await row.locator("summary").click();
    await row.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete rule" }).first().click();
    await expect(page.getByText(name)).toHaveCount(0);
  });

  test("a campaign can be drafted and its recipients counted", async ({ page }) => {
    await page.goto("/admin/campaigns");
    await page.getByRole("button", { name: "New campaign" }).click();
    await expect(page).toHaveURL(/\/admin\/campaigns\/.+/);
    await page.getByLabel("Subject line").fill("E2E subject");
    await page.getByLabel("Message").fill("Hello from the studio.");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/guest|recipient|would get/i).first()).toBeVisible();
  });

  test("new screens render", async ({ page }, info) => {
    for (const path of ["/admin", "/admin/reports", "/admin/pricing", "/admin/campaigns", "/admin/manifest", "/admin/settings"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${info.project.name}${path.replaceAll("/", "-")}.png`, fullPage: true });
    }
  });
});

test.describe("admin on a phone @mobile", () => {
  test("new screens fit a phone @mobile", async ({ page }, info) => {
    await login(page);
    for (const path of ["/admin", "/admin/reports", "/admin/pricing", "/admin/campaigns", "/admin/manifest", "/admin/settings"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${info.project.name}${path.replaceAll("/", "-")}.png`, fullPage: true });
    }
  });
});
