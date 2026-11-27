"use server";

import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp } from "@/app/api/_lib/http";
import { checkPassword, createAdminSession, destroyAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { TURNSTILE_FAILED, verifyTurnstile } from "@/lib/turnstile";

const THROTTLE_KEY = "adminLoginThrottle";
const WINDOW_MS = 15 * 60_000;
const MAX_IP_FAILS = 5;
const MAX_TRACKED_IPS = 500;

type Bucket = { fails: number; first: number };
type ThrottleState = {
  ips: Record<string, Bucket>;
};

export type LoginState = { error?: string; at?: number } | null;

function safeNext(next: string): string {
  return next.startsWith("/admin") && !next.startsWith("//") && !next.startsWith("/admin/login") ? next : "/admin";
}

function ipKey(ip: string): string {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "dev"}:${ip}`)
    .digest("hex")
    .slice(0, 16);
}

function prune(state: ThrottleState, now: number): ThrottleState {
  const ips: Record<string, Bucket> = {};
  const entries = Object.entries(state.ips ?? {})
    .filter(([, b]) => b && now - b.first <= WINDOW_MS)
    .slice(-MAX_TRACKED_IPS);
  for (const [k, b] of entries) ips[k] = b;
  return { ips };
}

async function mutateThrottle<T>(fn: (state: ThrottleState, now: number) => { state: ThrottleState; out: T }): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('rp:admin-login-throttle'))`);
    const now = Date.now();
    const [row] = await tx.select({ value: settings.value }).from(settings).where(eq(settings.key, THROTTLE_KEY)).limit(1);
    const current = prune((row?.value as ThrottleState | undefined) ?? { ips: {} }, now);
    const { state, out } = fn(current, now);
    await tx
      .insert(settings)
      .values({ key: THROTTLE_KEY, value: state, updatedAt: new Date(now) })
      .onConflictDoUpdate({ target: settings.key, set: { value: state, updatedAt: new Date(now) } });
    return out;
  });
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const ip = clientIp(await headers());
  const key = ipKey(ip);
  const now = Date.now();

  // Atomically check AND reserve a failed-attempt slot before verifying credentials so concurrent
  // brute-force bursts can't race past MAX_IP_FAILS. Cleared immediately on valid password.
  const pre = await mutateThrottle<{ blocked: boolean; mins: number; fails: number }>((s, ts) => {
    const prev = s.ips[key];
    if (prev && prev.fails >= MAX_IP_FAILS) {
      const mins = Math.max(1, Math.ceil((prev.first + WINDOW_MS - ts) / 60_000));
      return { state: s, out: { blocked: true, mins, fails: prev.fails } };
    }
    const nextIp: Bucket = prev ? { fails: prev.fails + 1, first: prev.first } : { fails: 1, first: ts };
    return { state: { ips: { ...s.ips, [key]: nextIp } }, out: { blocked: false, mins: 0, fails: nextIp.fails } };
  });

  if (pre.blocked) {
    return { error: `Too many attempts. Take a breather and try again in ${pre.mins} minute${pre.mins === 1 ? "" : "s"}.`, at: now };
  }

  const turnstile = formData.get("cf-turnstile-response");
  if (!(await verifyTurnstile(typeof turnstile === "string" ? turnstile : null, ip, { failClosed: true }))) {
    // Release the tentative failure count on Turnstile check failure so a widget hiccup doesn't lock out the owner.
    await mutateThrottle((s) => {
      const prev = s.ips[key];
      if (!prev) return { state: s, out: undefined };
      const ips = { ...s.ips };
      if (prev.fails <= 1) delete ips[key];
      else ips[key] = { ...prev, fails: prev.fails - 1 };
      return { state: { ips }, out: undefined };
    });
    return { error: TURNSTILE_FAILED, at: now };
  }

  const password = String(formData.get("password") ?? "");
  if (!password || !checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 450));
    const left = MAX_IP_FAILS - pre.fails;
    return {
      error: left > 0 ? "That password isn't right. Check caps lock and try again." : "Too many attempts. Try again in 15 minutes.",
      at: Date.now(),
    };
  }

  await mutateThrottle((s) => {
    const ips = { ...s.ips };
    delete ips[key];
    return { state: { ips }, out: undefined };
  });
  await createAdminSession();
  redirect(safeNext(String(formData.get("next") ?? "/admin")));
}

export async function logout(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/login");
}
