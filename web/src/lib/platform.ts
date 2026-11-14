/**
 * Stripe Connect platform link. A site with HQ_SITE_ID charges its client's
 * connected account and pays the platform fee. HQ owns the rate and account;
 * the last good answer is kept in settings so checkout survives HQ being down.
 */
import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { getSetting, setSetting } from "@/lib/automation/settings";
import { integrations } from "@/lib/config";

const HqConfig = z.object({
  stripeAccountId: z.string().regex(/^acct_/).nullable(),
  feeBps: z.number().int().min(0).max(2000),
  chargesEnabled: z.boolean(),
});
export type Platform = z.infer<typeof HqConfig>;

export const connectMode = (): boolean => Boolean(process.env.HQ_SITE_ID);

export async function getPlatform(): Promise<Platform> {
  const saved = await getSetting<Platform>("platform");
  if (saved) return saved;
  const stripeAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID || null;
  return { stripeAccountId, feeBps: Number(process.env.PLATFORM_FEE_BPS ?? 300), chargesEnabled: Boolean(stripeAccountId) };
}

/** False stops a checkout before it holds a slot, so a guest's money can never land in the platform's own balance. */
export async function paymentsReady(): Promise<boolean> {
  if (!connectMode() || !integrations.stripe()) return true;
  const p = await getPlatform();
  return Boolean(p.stripeAccountId && p.chargesEnabled);
}

/** The connected account for Stripe calls. Undefined in plain Stripe mode. */
export async function connectedAccount(): Promise<string | undefined> {
  if (!connectMode()) return undefined;
  const { stripeAccountId } = await getPlatform();
  if (!stripeAccountId) throw new Error("This site has no connected Stripe account yet.");
  return stripeAccountId;
}

/** Fee rate to build into guest prices, or 0 when the client absorbs it. */
export async function passOnBps(): Promise<number> {
  if (!connectMode() || (await getSetting<boolean>("platformFeePassOn")) !== true) return 0;
  return (await getPlatform()).feeBps;
}

export function signReport(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export type SiteReport = {
  date: string;
  bookings: number;
  sessions: number;
  grossCents: number;
  refundedCents: number;
  giftCardsSoldCents: number;
  platformFeeCents: number;
  occupancyPct: number;
  upcomingSessions: number;
  failedEmails: number;
  appVersion: string;
};

/** Sends the signed daily aggregates to HQ and stores the config it answers with. Guest details never leave this site. */
export async function sendReport(report: SiteReport): Promise<Platform> {
  const { HQ_URL, HQ_SITE_ID, HQ_SECRET } = process.env;
  if (!HQ_URL || !HQ_SITE_ID || !HQ_SECRET) throw new Error("HQ_URL, HQ_SITE_ID and HQ_SECRET must all be set.");
  const body = JSON.stringify(report);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const res = await fetch(`${HQ_URL}/api/sites/report`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hq-site": HQ_SITE_ID,
      "x-hq-timestamp": timestamp,
      "x-hq-signature": signReport(HQ_SECRET, timestamp, body),
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HQ answered ${res.status}`);
  const config = HqConfig.parse(await res.json());
  await setSetting("platform", config);
  return config;
}
