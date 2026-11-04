import "server-only";

/**
 * Cloudflare Turnstile (bot check on public forms). With no TURNSTILE_SECRET_KEY it's a no-op,
 * like the other integrations, so local dev and tests work without keys.
 */
export async function verifyTurnstile(token: string | null | undefined, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, ...(ip && ip !== "unknown" ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    return Boolean(((await res.json()) as { success?: boolean }).success);
  } catch (err) {
    // Cloudflare unreachable: let real people through rather than block every booking; rate limits still apply.
    console.error("[turnstile] verify failed", err);
    return true;
  }
}

export const TURNSTILE_FAILED = "Please complete the quick security check and try again.";
