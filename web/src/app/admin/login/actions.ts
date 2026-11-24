"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, createAdminSession, destroyAdminSession } from "@/lib/auth";

/* shortcut: in-memory throttle (5 fails / 10 min / IP) is per server instance and resets on cold start; move it to the DB or a KV store if brute force becomes a concern. */
const WINDOW_MS = 10 * 60_000;
const MAX_FAILS = 5;
type Store = Map<string, { fails: number; first: number }>;
const g = globalThis as unknown as { __rpLoginThrottle?: Store };
const store: Store = (g.__rpLoginThrottle ??= new Map());

export type LoginState = { error?: string } | null;

function safeNext(next: string): string {
  return next.startsWith("/admin") && !next.startsWith("//") && !next.startsWith("/admin/login") ? next : "/admin";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
  const now = Date.now();
  const entry = store.get(ip);
  if (entry && now - entry.first > WINDOW_MS) store.delete(ip);
  const cur = store.get(ip);
  if (cur && cur.fails >= MAX_FAILS) {
    const mins = Math.ceil((cur.first + WINDOW_MS - now) / 60_000);
    return { error: `Too many attempts. Take a breather and try again in ${mins} minute${mins === 1 ? "" : "s"}.` };
  }

  const password = String(formData.get("password") ?? "");
  if (!password || !checkPassword(password)) {
    store.set(ip, { fails: (cur?.fails ?? 0) + 1, first: cur?.first ?? now });
    await new Promise((r) => setTimeout(r, 400));
    const left = MAX_FAILS - (store.get(ip)?.fails ?? 0);
    return { error: left > 0 ? "That password isn't right. Check caps lock and try again." : "Too many attempts. Try again in 10 minutes." };
  }
  store.delete(ip);
  await createAdminSession();
  redirect(safeNext(String(formData.get("next") ?? "/admin")));
}

export async function logout(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/login");
}
