import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type Stripe from "stripe";

const stored = vi.hoisted(() => ({ settings: {} as Record<string, unknown> }));
const calls = vi.hoisted(() => ({ create: vi.fn(), refund: vi.fn() }));

vi.mock("@/lib/automation/settings", () => ({
  getSetting: async (k: string) => stored.settings[k],
  setSetting: async (k: string, v: unknown) => void (stored.settings[k] = v),
}));
vi.mock("stripe", () => ({
  default: class {
    checkout = { sessions: { create: calls.create } };
    refunds = { create: calls.refund };
  },
}));

import { passOnCents, platformFeeCents, withPassOn } from "@/lib/booking/pricing";
import { createCheckoutSession, refundPayment } from "@/lib/integrations/stripe";
import { passOnBps, paymentsReady, sendReport, signReport, type SiteReport } from "@/lib/platform";
import { processStripeEvent } from "@/app/api/_lib/stripe-sync";

const checkout = {
  kind: "booking" as const,
  refId: "b1",
  email: "guest@example.com",
  lines: [{ name: "Session", amountCents: 30000 }],
  successUrl: "https://x.test/ok",
  cancelUrl: "https://x.test/no",
  expiresInMinutes: 30,
  description: "Session",
};

beforeEach(() => {
  stored.settings = {};
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
  vi.stubEnv("HQ_SITE_ID", "site_1");
  vi.stubEnv("STRIPE_CONNECTED_ACCOUNT_ID", "");
  calls.create.mockReset().mockResolvedValue({ id: "cs_1", url: "https://stripe.test" });
  calls.refund.mockReset().mockResolvedValue({ id: "re_1" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("fee maths", () => {
  test("3% of a card charge, in whole cents", () => {
    expect(platformFeeCents(30000, 300)).toBe(900);
    expect(platformFeeCents(33333, 300)).toBe(1000);
  });

  test("pass-on keeps the client whole, rounds to dollars, and leaves zero alone", () => {
    expect(passOnCents(15000, 300)).toBe(15500);
    expect(passOnCents(15000, 0)).toBe(15000);
    expect(passOnCents(0, 300)).toBe(0);
    const net = passOnCents(15000, 300) - platformFeeCents(passOnCents(15000, 300), 300);
    expect(net).toBeGreaterThanOrEqual(15000);
  });

  test("withPassOn changes list prices and nothing else", () => {
    const e = { durationOptions: [{ minutes: 120, priceCents: 15000 }], extraGuestCents: 5000 };
    expect(withPassOn(e, 300)).toEqual({ durationOptions: [{ minutes: 120, priceCents: 15500 }], extraGuestCents: 5200 });
    expect(withPassOn(e, 0)).toBe(e);
  });
});

describe("connect charges", () => {
  test("a charge runs on the connected account and carries the fee", async () => {
    stored.settings.platform = { stripeAccountId: "acct_1", feeBps: 300, chargesEnabled: true };
    await createCheckoutSession(checkout);
    const [params, options] = calls.create.mock.calls[0];
    expect(params.payment_intent_data.application_fee_amount).toBe(900);
    expect(options).toEqual({ stripeAccount: "acct_1" });
  });

  test("the fee follows the rate HQ sets", async () => {
    stored.settings.platform = { stripeAccountId: "acct_1", feeBps: 500, chargesEnabled: true };
    await createCheckoutSession(checkout);
    expect(calls.create.mock.calls[0][0].payment_intent_data.application_fee_amount).toBe(1500);
  });

  test("a Connect site with no account never charges the platform balance", async () => {
    await expect(createCheckoutSession(checkout)).rejects.toThrow(/connected Stripe account/);
    expect(calls.create).not.toHaveBeenCalled();
    expect(await paymentsReady()).toBe(false);
  });

  test("payments wait for the account to be enabled", async () => {
    stored.settings.platform = { stripeAccountId: "acct_1", feeBps: 300, chargesEnabled: false };
    expect(await paymentsReady()).toBe(false);
  });

  test("a plain Stripe site is unchanged: no fee, no account", async () => {
    vi.stubEnv("HQ_SITE_ID", "");
    await createCheckoutSession(checkout);
    const [params, options] = calls.create.mock.calls[0];
    expect(params.payment_intent_data.application_fee_amount).toBeUndefined();
    expect(options).toBeUndefined();
    expect(await paymentsReady()).toBe(true);
  });

  test("refunds run on the connected account and keep the platform fee", async () => {
    stored.settings.platform = { stripeAccountId: "acct_1", feeBps: 300, chargesEnabled: true };
    await refundPayment({ paymentIntentId: "pi_1", amountCents: 30000 });
    const [params, options] = calls.refund.mock.calls[0];
    expect(options).toEqual({ stripeAccount: "acct_1" });
    expect(params.refund_application_fee).toBeUndefined();
  });
});

describe("pass-on switch", () => {
  test("is off unless the client turns it on", async () => {
    stored.settings.platform = { stripeAccountId: "acct_1", feeBps: 300, chargesEnabled: true };
    expect(await passOnBps()).toBe(0);
    stored.settings.platformFeePassOn = true;
    expect(await passOnBps()).toBe(300);
  });

  test("does nothing on a site outside Connect", async () => {
    vi.stubEnv("HQ_SITE_ID", "");
    stored.settings.platformFeePassOn = true;
    expect(await passOnBps()).toBe(0);
  });
});

describe("webhooks", () => {
  test("another client's event is ignored", async () => {
    stored.settings.platform = { stripeAccountId: "acct_1", feeBps: 300, chargesEnabled: true };
    const event = { type: "charge.refunded", account: "acct_other", data: { object: {} } } as unknown as Stripe.Event;
    expect(await processStripeEvent(event)).toMatch(/another account/);
  });

  test("a site not onboarded yet ignores events instead of failing, so Stripe doesn't retry them", async () => {
    const event = { type: "charge.refunded", account: "acct_other", data: { object: {} } } as unknown as Stripe.Event;
    expect(await processStripeEvent(event)).toMatch(/another account/);
  });
});

describe("HQ report", () => {
  const report: SiteReport = {
    date: "2026-11-05", bookings: 1, sessions: 1, grossCents: 100, refundedCents: 0, giftCardsSoldCents: 0,
    platformFeeCents: 3, occupancyPct: 1, upcomingSessions: 0, failedEmails: 0, appVersion: "dev",
  };

  test("signs timestamp and body with the site secret", () => {
    expect(signReport("s", "1", "{}")).toBe(createHmac("sha256", "s").update("1.{}").digest("hex"));
  });

  test("stores the config HQ returns", async () => {
    vi.stubEnv("HQ_URL", "https://hq.test");
    vi.stubEnv("HQ_SECRET", "s");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ stripeAccountId: "acct_9", feeBps: 250, chargesEnabled: true })));
    await sendReport(report);
    expect(stored.settings.platform).toEqual({ stripeAccountId: "acct_9", feeBps: 250, chargesEnabled: true });
  });

  test("a bad answer from HQ leaves the last good config alone", async () => {
    vi.stubEnv("HQ_URL", "https://hq.test");
    vi.stubEnv("HQ_SECRET", "s");
    const good = { stripeAccountId: "acct_1", feeBps: 300, chargesEnabled: true };
    stored.settings.platform = good;
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ stripeAccountId: "nope", feeBps: 99999, chargesEnabled: true })));
    await expect(sendReport(report)).rejects.toThrow();
    expect(stored.settings.platform).toEqual(good);
  });
});
