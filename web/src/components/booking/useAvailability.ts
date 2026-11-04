"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { firstOfMonth, lastOfMonth, type MonthKey } from "./dates";

export type ApiSlot = { start: string; end: string; available: boolean; reason?: string };
export type ApiDay = { date: string; open: boolean; available: number; slots: ApiSlot[] };
export type DayState = "available" | "full" | "unavailable";

export function dayState(d: ApiDay | undefined): DayState {
  if (!d || !d.open || d.slots.length === 0) return "unavailable";
  if (d.available > 0) return "available";
  // Fully booked (as opposed to past / too soon / too far) → offer the waitlist.
  return d.slots.some((s) => s.reason === "booked" || s.reason === "blocked" || s.reason === "calendar") ? "full" : "unavailable";
}

type Result = {
  status: "idle" | "loading" | "ready" | "error";
  days: Record<string, ApiDay>;
  calendarError: boolean;
  error: string | null;
  reload: () => void;
};

type CacheEntry = { at: number; days: Record<string, ApiDay>; calendarError: boolean };
const cache = new Map<string, CacheEntry>();
const FRESH_MS = 30_000;

/**
 * One month of availability for an experience + duration. Months are cached
 * briefly so flipping back and forth doesn't refetch; `reload` forces it.
 */
export function useAvailability(opts: {
  slug: string | null;
  duration: number;
  month: MonthKey;
  booking?: { code: string; token: string } | null;
}): Result {
  const { slug, duration, month, booking } = opts;
  const key = slug ? `${slug}|${duration}|${month}|${booking?.code ?? ""}` : "";
  const [state, setState] = useState<{ key: string; status: Result["status"]; entry: CacheEntry | null; error: string | null }>({
    key: "",
    status: "idle",
    entry: null,
    error: null,
  });
  const [nonce, setNonce] = useState(0);
  const lastNonce = useRef(0);

  useEffect(() => {
    if (!slug) return;
    const force = nonce !== lastNonce.current;
    lastNonce.current = nonce;
    const hit = cache.get(key);
    if (hit && !force && Date.now() - hit.at < FRESH_MS) {
      setState({ key, status: "ready", entry: hit, error: null });
      return;
    }
    const ctrl = new AbortController();
    setState((s) => ({ key, status: "loading", entry: s.key === key ? s.entry : (hit ?? null), error: null }));
    const qs = new URLSearchParams({
      experience: slug,
      from: firstOfMonth(month),
      to: lastOfMonth(month),
      duration: String(duration),
      ...(booking ? { booking: booking.code, t: booking.token } : {}),
    });
    fetch(`/api/availability?${qs}`, { signal: ctrl.signal, cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? "We couldn't load times.");
        const days: Record<string, ApiDay> = {};
        for (const d of body.days as ApiDay[]) days[d.date] = d;
        const entry = { at: Date.now(), days, calendarError: Boolean(body.calendarError) };
        cache.set(key, entry);
        setState({ key, status: "ready", entry, error: null });
      })
      .catch((err: Error) => {
        if (ctrl.signal.aborted) return;
        setState({ key, status: "error", entry: null, error: err.message || "We couldn't load times." });
      });
    return () => ctrl.abort();
  }, [key, slug, duration, month, booking, nonce]);

  const reload = useCallback(() => {
    cache.delete(key);
    setNonce((n) => n + 1);
  }, [key]);

  const current = state.key === key ? state : { status: slug ? ("loading" as const) : ("idle" as const), entry: null, error: null };
  return {
    status: current.status,
    days: current.entry?.days ?? {},
    calendarError: current.entry?.calendarError ?? false,
    error: current.error,
    reload,
  };
}
