"use server";

import { TURNSTILE_FAILED, verifyTurnstile } from "@/lib/turnstile";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { sendManageLinks } from "@/lib/email/notify";
import { LIMITS, clientIp, rateLimit } from "@/app/api/_lib/http";

export type FindState = { status: "idle" | "sent" | "error"; message: string | null };

/**
 * Email the guest links to every booking on their address. Always answers the
 * same way so the form can't be used to find out who has booked.
 */
export async function requestManageLinks(_prev: FindState, form: FormData): Promise<FindState> {
  if (form.get("website")) return { status: "sent", message: null };
  const parsed = z.email().max(200).safeParse(String(form.get("email") ?? "").trim());
  if (!parsed.success) return { status: "error", message: "Enter the email address you booked with." };
  const ip = clientIp(await headers());
  if (!(await verifyTurnstile(form.get("cf-turnstile-response") as string | null, ip))) return { status: "error", message: TURNSTILE_FAILED };
  if (!rateLimit(`manage:${ip}`, LIMITS.manageLinks) || !rateLimit(`manage-email:${parsed.data.toLowerCase()}`, { capacity: 3, perMinute: 0.2 })) {
    return { status: "error", message: "You've asked a few times already. Please check your inbox (and spam) or try again in a few minutes." };
  }
  // Send after responding, so response time doesn't reveal whether the address has bookings.
  after(() => sendManageLinks(parsed.data).catch((err) => console.error("[manage] sendManageLinks failed", err)));
  return { status: "sent", message: null };
}
