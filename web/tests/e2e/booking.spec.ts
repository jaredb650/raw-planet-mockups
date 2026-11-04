/**
 * Guest booking flow, end to end, against a running dev server in Stripe test
 * mode (no STRIPE_SECRET_KEY → /checkout/test/...). See playwright.config.ts.
 *
 * Every test books a real slot and cancels it again, so the suite can run
 * repeatedly against the same seeded database.
 */
import { expect, test, type Page } from "@playwright/test";

const EXPERIENCE = "music-production";

async function pickFirstOpenSlot(page: Page, group = "Pick a start time") {
  const slots = page.getByRole("group", { name: group }).getByRole("button", { disabled: false });
  await expect(slots.first()).toBeVisible();
  await slots.first().click();
  return slots.first();
}

async function fillDetails(page: Page, opts: { name?: string; email?: string } = {}) {
  await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
  await page.getByLabel("Full name").fill(opts.name ?? "E2E Guest");
  await page.getByLabel("Email", { exact: true }).fill(opts.email ?? `e2e+${Date.now()}@example.com`);
  await page.getByRole("checkbox", { name: /I agree to the/ }).check();
}

/** /book → first open slot → details → test checkout. Returns the test checkout page. */
async function startBooking(page: Page) {
  await page.goto(`/book?experience=${EXPERIENCE}`);
  await expect(page.getByRole("tab", { name: /Music production/ })).toHaveAttribute("aria-selected", "true");
  // The first open day is selected automatically.
  await expect(page.getByRole("grid").locator('button[aria-pressed="true"]')).toBeVisible();
  await pickFirstOpenSlot(page);
  await page.getByRole("link", { name: "Continue" }).click();
  await fillDetails(page);
  await page.getByRole("button", { name: /Continue to payment/ }).click();
  await expect(page).toHaveURL(/\/checkout\/test\/booking\//);
  await expect(page.getByText("Test mode · no card is charged")).toBeVisible();
}

async function cancelFromManage(page: Page) {
  await page.getByRole("button", { name: "Cancel booking" }).click();
  const dialog = page.getByRole("dialog", { name: "Cancel this session?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/back to your card/)).toBeVisible();
  await dialog.getByRole("button", { name: "Yes, cancel it" }).click();
  await expect(page.getByText("Your booking is cancelled.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Booking cancelled" })).toBeVisible();
}

test.describe("booking", () => {
  test("book, pay (test mode), confirm, reschedule and cancel", async ({ page }) => {
    await startBooking(page);
    await page.getByRole("button", { name: /Pay \$[\d,]+ \(test\)/ }).click();

    await expect(page.getByRole("heading", { name: /You.re in, E2E/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add to calendar (.ics)" })).toBeVisible();
    const code = (await page.getByText(/^Booking RP-/).textContent())!.replace("Booking ", "").trim();

    // .ics download works for the guest's token.
    const ics = await page.request.get((await page.getByRole("link", { name: "Add to calendar (.ics)" }).getAttribute("href"))!);
    expect(ics.status()).toBe(200);
    expect(await ics.text()).toContain("BEGIN:VEVENT");

    await page.getByRole("link", { name: "Change or cancel" }).click();
    await expect(page).toHaveURL(new RegExp(`/manage/${code}\\?t=`));
    await expect(page.getByRole("heading", { name: /^See you/ })).toBeVisible();
    await expect(page.getByText(/Payment received/)).toBeVisible(); // public timeline

    // Reschedule: the last open time on the selected day (the first is usually our own slot).
    const slots = page.getByRole("group", { name: "Pick a new start time" }).getByRole("button", { disabled: false });
    await expect(slots.first()).toBeVisible();
    await slots.last().click();
    const confirm = page.getByRole("button", { name: "Confirm new time" });
    if (await confirm.isDisabled()) await slots.nth(1).click();
    await confirm.click();
    await expect(page.getByText(/Done\. Your session is now on/)).toBeVisible();
    await expect(page.getByText("1 change left")).toBeVisible();

    await cancelFromManage(page);
  });

  test("leaving checkout releases the hold", async ({ page }) => {
    await startBooking(page);
    await page.getByRole("button", { name: "Cancel and go back" }).click();
    await expect(page).toHaveURL(/\/book\/music-production\?cancelled=RP-/);
    await expect(page.getByText(/your spot was released/)).toBeVisible();
  });

  test("promo code applies at checkout", async ({ page }) => {
    await page.goto(`/book/${EXPERIENCE}`);
    await pickFirstOpenSlot(page);
    await page.getByRole("link", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
    await page.getByText("Promo code or gift card").click();
    await page.getByLabel("Promo code").fill("NOPE-NOT-REAL");
    await page.getByRole("button", { name: "Apply", exact: true }).first().click();
    await expect(page.getByText("We don't recognise that code.")).toBeVisible();
    await page.getByRole("button", { name: "Remove", exact: true }).first().click();
    await expect(page.getByLabel("Promo code")).toHaveValue("");
    await page.getByLabel("Promo code").fill("WELCOME10");
    await page.getByRole("button", { name: "Apply", exact: true }).first().click();
    await expect(page.getByText("Applied.")).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Booking summary" }).getByText("Code WELCOME10")).toBeVisible();
  });

  test("gift card: buy one, then pay for a whole booking with it", async ({ page }) => {
    await page.goto("/gift-cards");
    await page.getByRole("radio", { name: /\$300/ }).check();
    await page.getByLabel("Their name").fill("Robin");
    await page.getByLabel("Your name").fill("E2E Gifter");
    await page.getByLabel("Your email").fill(`gift+${Date.now()}@example.com`);
    await page.getByRole("button", { name: /Buy gift card · \$300/ }).click();
    await expect(page).toHaveURL(/\/checkout\/test\/gift_card\//);
    await page.getByRole("button", { name: /Pay \$300 \(test\)/ }).click();
    await expect(page.getByRole("heading", { name: "Your gift is ready" })).toBeVisible();
    const giftCode = (await page.getByText(/^RAW-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/).textContent())!.trim();
    expect(giftCode).toMatch(/^RAW-/);

    const bal = await page.request.get(`/api/gift-cards/balance?code=${giftCode}`);
    expect(await bal.json()).toMatchObject({ balanceCents: 30000, status: "active" });

    // Two guests × 2 hours = $300, fully covered → no payment step.
    await page.goto(`/book/${EXPERIENCE}`);
    await pickFirstOpenSlot(page);
    await page.getByRole("link", { name: "Continue" }).click();
    await fillDetails(page, { name: "Robin Gift" });
    await page.getByText("Promo code or gift card").click();
    await page.getByLabel("Gift card").fill(giftCode);
    await page.getByRole("button", { name: "Apply", exact: true }).nth(1).click();
    await expect(page.getByRole("button", { name: "Confirm booking" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("heading", { name: /You.re in, Robin/ })).toBeVisible();

    const spent = await page.request.get(`/api/gift-cards/balance?code=${giftCode}`);
    expect(await spent.json()).toMatchObject({ balanceCents: 0, status: "depleted" });

    // Cancelling returns the balance to the card.
    await page.getByRole("link", { name: "Change or cancel" }).click();
    await page.getByRole("button", { name: "Cancel booking" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancel this session?" });
    await expect(dialog.getByText(/\$300 back on your gift card/)).toBeVisible();
    await dialog.getByRole("button", { name: "Yes, cancel it" }).click();
    await expect(page.getByText("Your booking is cancelled.")).toBeVisible();
    const back = await page.request.get(`/api/gift-cards/balance?code=${giftCode}`);
    expect(await back.json()).toMatchObject({ balanceCents: 30000, status: "active" });
  });

  test("manage links: neutral answer, bad tokens rejected", async ({ page }) => {
    await page.goto("/manage");
    await page.getByLabel("Email you booked with").fill("nobody-here@example.com");
    await page.getByRole("button", { name: "Email me my booking links" }).click();
    await expect(page.getByText("Check your inbox.")).toBeVisible();

    await page.goto("/manage/RP-NOPE00?t=bad");
    await expect(page.getByRole("heading", { name: "Link not valid" })).toBeVisible();
    const res = await page.request.get("/booking/RP-NOPE00?t=bad");
    expect(res.status()).toBe(404);
  });

  test("keyboard: calendar grid supports arrow keys", async ({ page }) => {
    await page.goto(`/book?experience=${EXPERIENCE}`);
    const selected = page.getByRole("grid").locator('button[aria-pressed="true"]');
    await expect(selected).toBeVisible();
    await selected.focus();
    const before = await selected.getAttribute("data-date");
    await page.keyboard.press("ArrowRight");
    const focused = page.locator(":focus");
    await expect(focused).toHaveAttribute("data-date", /\d{4}-\d{2}-\d{2}/);
    expect(await focused.getAttribute("data-date")).not.toBe(before);
  });
});

test.describe("api", () => {
  test("availability validates input", async ({ request }) => {
    const bad = await request.get(`/api/availability?experience=${EXPERIENCE}&from=2026-01-01&to=2026-01-02&duration=7`);
    expect(bad.status()).toBe(400);
    const today = new Date().toISOString().slice(0, 10);
    const ok = await request.get(`/api/availability?experience=${EXPERIENCE}&from=${today}&to=${today}&duration=120`);
    expect(ok.status()).toBe(200);
    expect((await ok.json()).days).toHaveLength(1);
  });

  test("checkout rejects bots and missing consent", async ({ request }) => {
    const base = { experience: EXPERIENCE, start: new Date(Date.now() + 5 * 86400_000).toISOString(), duration: 120, guests: 2, name: "Bot", email: "bot@example.com" };
    const noConsent = await request.post("/api/checkout", { data: base });
    expect(noConsent.status()).toBe(400);
    expect((await noConsent.json()).fields).toHaveProperty("acceptPolicies");
    const honeypot = await request.post("/api/checkout", { data: { ...base, acceptPolicies: true, website: "http://spam" } });
    expect(honeypot.status()).toBe(400);
  });

  test("webhooks accept unsigned events in dev", async ({ request }) => {
    const cal = await request.post("/api/webhooks/calcom", { data: { triggerEvent: "PING", payload: {} } });
    expect(cal.status()).toBe(200);
    const stripe = await request.post("/api/webhooks/stripe", {
      data: { id: `evt_e2e_${Date.now()}`, type: "customer.created", data: { object: {} } },
    });
    expect(stripe.status()).toBe(200);
  });
});

test.describe("mobile @mobile", () => {
  test("booking page fits a phone and keeps the CTA in reach @mobile", async ({ page }) => {
    await page.goto(`/book?experience=${EXPERIENCE}`);
    await expect(page.getByRole("grid").locator('button[aria-pressed="true"]')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await pickFirstOpenSlot(page);
    await expect(page.getByRole("link", { name: "Continue" })).toBeInViewport();
  });
});
