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
const MAX_GLOBAL_FAILS = 25;
const MAX_TRACKED_IPS = 500;

type Bucket = { fails: number; first: number };
type ThrottleState = {
  ips: Record<string, Bucket>;
  global: Bucket;
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
  const global = state.global && now - state.global.first <= WINDOW_MS ? state.global : { fails: 0, first: now };
  return { ips, global };
}

async function readThrottle(now: number): Promise<ThrottleState> {
  const db = await getDb();
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, THROTTLE_KEY)).limit(1);
  return prune((row?.value as ThrottleState | undefined) ?? { ips: {}, global: { fails: 0, first: now } }, now);
}

async function mutateThrottle<T>(fn: (state: ThrottleState, now: number) => { state: ThrottleState; out: T }): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('rp:admin-login-throttle'))`);
    const now = Date.now();
    const [row] = await tx.select({ value: settings.value }).from(settings).where(eq(settings.key, THROTTLE_KEY)).limit(1);
    const current = prune((row?.value as ThrottleState | undefined) ?? { ips: {}, global: { fails: 0, first: now } }, now);
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

  const current = await readThrottle(now);
  const ipBucket = current.ips[key];
  if (ipBucket && ipBucket.fails >= MAX_IP_FAILS) {
    const mins = Math.max(1, Math.ceil((ipBucket.first + WINDOW_MS - now) / 60_000));
    return { error: `Too many attempts. Take a breather and try again in ${mins} minute${mins === 1 ? "" : "s"}.`, at: now };
  }
  if (current.global.fails >= MAX_GLOBAL_FAILS) {
    const mins = Math.max(1, Math.ceil((current.global.first + WINDOW_MS - now) / 60_000));
    return { error: `Sign-in is temporarily paused due to too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`, at: now };
  }

  const turnstile = formData.get("cf-turnstile-response");
  if (!(await verifyTurnstile(typeof turnstile === "string" ? turnstile : null, ip))) {
    return { error: TURNSTILE_FAILED, at: now };
  }

  const password = String(formData.get("password") ?? "");
  if (!password || !checkPassword(password)) {
    const ipFails = await mutateThrottle((s, ts) => {
      const prev = s.ips[key];
      const nextIp: Bucket = prev ? { fails: prev.fails + 1, first: prev.first } : { fails: 1, first: ts };
      const nextGlobal: Bucket = s.global.fails > 0 ? { fails: s.global.fails + 1, first: s.global.first } : { fails: 1, first: ts };
      return { state: { ips: { ...s.ips, [key]: nextIp }, global: nextGlobal }, out: nextIp.fails };
    });
    await new Promise((r) => setTimeout(r, 450));
    const left = MAX_IP_FAILS - ipFails;
    return {
      error: left > 0 ? "That password isn't right. Check caps lock and try again." : "Too many attempts. Try again in 15 minutes.",
      at: Date.now(),
    };
  }

  await mutateThrottle((s) => {
    const ips = { ...s.ips };
    delete ips[key];
    return { state: { ...s, ips }, out: undefined };
  });
  await createAdminSession();
  redirect(safeNext(String(formData.get("next") ?? "/admin")));
}

export async function logout(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/login");
}
