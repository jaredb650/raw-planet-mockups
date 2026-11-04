import "server-only";
import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/auth";
import { parseDollars } from "@/lib/money";
import { fromLocal } from "@/lib/time";
import type { ActionResult } from "@/components/admin/types";

/**
 * Run an admin mutation: checks the session, turns thrown errors into a
 * friendly message for the form, and revalidates the admin tree.
 */
export async function adminAction(
  fn: () => Promise<string | void | { message?: string; data?: NonNullable<ActionResult>["data"] }>,
  opts: { revalidate?: string[] } = {},
): Promise<ActionResult> {
  await requireAdmin();
  try {
    const r = await fn();
    for (const p of opts.revalidate ?? ["/admin"]) revalidatePath(p, "layout");
    if (typeof r === "string" || r === undefined) return { ok: true, message: r ?? "Saved.", at: Date.now() };
    return { ok: true, message: r.message ?? "Saved.", data: r.data, at: Date.now() };
  } catch (err) {
    unstable_rethrow(err);
    return { ok: false, message: errorMessage(err), at: Date.now() };
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ZodError) {
    const i = err.issues[0];
    const field = i?.path?.length ? `${String(i.path.join("."))}: ` : "";
    return `${field}${i?.message ?? "Check the form."}`;
  }
  if (err instanceof Error) return err.message || "Something went wrong.";
  return "Something went wrong.";
}

/* ---------------------------- form parsing ---------------------------- */

export const str = (fd: FormData, k: string): string => String(fd.get(k) ?? "").trim();
export const optStr = (fd: FormData, k: string): string | null => str(fd, k) || null;
export const bool = (fd: FormData, k: string): boolean => {
  const v = fd.get(k);
  return v === "on" || v === "true" || v === "1" || v === "yes";
};
export function int(fd: FormData, k: string, fallback?: number): number {
  const s = str(fd, k);
  if (s === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`${label(k)} is required.`);
  }
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`${label(k)} must be a whole number.`);
  return n;
}
export function optInt(fd: FormData, k: string): number | null {
  const s = str(fd, k);
  if (s === "") return null;
  return int(fd, k);
}
/** "$150.50" → 15050 cents. */
export function cents(fd: FormData, k: string, fallback?: number): number {
  const s = str(fd, k);
  if (s === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`${label(k)} is required.`);
  }
  const c = parseDollars(s);
  if (c === null) throw new Error(`${label(k)} must be a dollar amount.`);
  return c;
}
export function optCents(fd: FormData, k: string): number | null {
  return str(fd, k) === "" ? null : cents(fd, k);
}
/** Business-local date (+ optional time) fields → UTC Date. */
export function localDateTime(fd: FormData, dateKey: string, timeKey?: string, defaultTime = "00:00"): Date {
  const d = str(fd, dateKey);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`${label(dateKey)} is required.`);
  const t = timeKey ? str(fd, timeKey) || defaultTime : defaultTime;
  if (!/^\d{2}:\d{2}$/.test(t)) throw new Error(`${label(timeKey ?? "time")} must be a time.`);
  return fromLocal(d, t);
}
export function lines(fd: FormData, k: string): string[] {
  return str(fd, k)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function label(k: string) {
  const s = k.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
