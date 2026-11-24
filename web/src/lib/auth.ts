/**
 * Owner/admin authentication: a single shared password (ADMIN_PASSWORD) →
 * signed, httpOnly session cookie (JWT, HS256, 30 days). Good fit for a
 * one-person business; swap for Auth.js/Clerk if staff accounts are needed.
 */
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { createHash, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "rp_admin";
const MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Signing key = AUTH_SECRET + the admin password. Changing ADMIN_PASSWORD (or AUTH_SECRET)
 * therefore signs out every existing session — the "log out everywhere" switch.
 */
function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be set in production");
  const pw = process.env.ADMIN_PASSWORD ?? "";
  return createHash("sha256").update(`${s ?? "dev-only-insecure-secret-change-me-please-32b"}:${pw}`).digest();
}

export function adminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD) || process.env.NODE_ENV !== "production";
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? (process.env.NODE_ENV !== "production" ? "rawplanet" : "");
  if (!expected) return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function createAdminSession(): Promise<void> {
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroyAdminSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.role === "admin";
  } catch {
    return false;
  }
}

export async function isAdmin(): Promise<boolean> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Use at the top of every admin page, server action and admin API route. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

/** For route handlers: returns a 401 Response when not signed in, else null. */
export async function adminGuard(): Promise<Response | null> {
  return (await isAdmin()) ? null : Response.json({ error: "Unauthorized" }, { status: 401 });
}
