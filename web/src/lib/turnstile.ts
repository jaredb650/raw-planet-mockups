import "server-only";

/**
 * Cloudflare Turnstile (bot check on public forms). With no TURNSTILE_SECRET_KEY it's a no-op,
 * like the other integrations, so local dev and tests work without keys.
 */
let warnedMissing = false;

export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string,
  opts?: { failClosed?: boolean },
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production" && !warnedMissing) {
      warnedMissing = true;
      console.error("[turnstile] TURNSTILE_SECRET_KEY is not set in production");
    }
    return true;
  }
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, ...(ip && ip !== "unknown" ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Turnstile HTTP ${res.status}`);
    return Boolean(((await res.json()) as { success?: boolean }).success);
  } catch (err) {
    console.error("[turnstile] verify failed", err);
    return opts?.failClosed ? false : true;
  }
}

export const TURNSTILE_FAILED = "Please complete the quick security check and try again.";
