"use client";

import { useEffect, useState } from "react";
import a from "./admin.module.css";
import p from "./picker.module.css";

export type PickerSlot = { start: string; end: string; available: boolean; reason: string | null };

const REASON: Record<string, string> = {
  past: "Past",
  booked: "Booked",
  blocked: "Blocked",
  calendar: "Busy in calendar",
  too_far: "Too far ahead",
  notice: "Short notice",
};

const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
export const nyTime = (iso: string) => timeFmt.format(new Date(iso)).replace(":00", "").replace(" ", "").toLowerCase();
const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false });
export const nyHHMM = (iso: string) => hhmm.format(new Date(iso));

/**
 * Shows one day's start times for an experience (business-local), fetched from
 * /api/admin/availability. Taken times are shown greyed with the reason, so the
 * host can see why; picking calls onPick(startIso).
 */
export function SlotPicker({
  experienceId,
  date,
  duration,
  ignoreBookingId,
  value,
  onPick,
  name,
}: {
  experienceId: string;
  date: string;
  duration: number;
  ignoreBookingId?: string;
  value: string | null;
  onPick: (iso: string | null) => void;
  name?: string;
}) {
  const key = experienceId && date && duration ? `${experienceId}|${date}|${duration}|${ignoreBookingId ?? ""}` : "";
  const [state, setState] = useState<{ key: string; slots: PickerSlot[]; open: boolean; calendarError: boolean; error?: string } | null>(null);

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ experienceId, date, duration: String(duration) });
    if (ignoreBookingId) qs.set("ignore", ignoreBookingId);
    fetch(`/api/admin/availability?${qs}`, { signal: ctrl.signal, cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 401 ? "Signed out — reload the page." : "Couldn't load times.");
        return r.json();
      })
      .then((j) => setState({ key, slots: j.slots, open: j.open, calendarError: j.calendarError }))
      .catch((e) => {
        if (e.name !== "AbortError") setState({ key, slots: [], open: true, calendarError: false, error: String(e.message ?? e) });
      });
    return () => ctrl.abort();
  }, [key, experienceId, date, duration, ignoreBookingId]);

  const loading = Boolean(key) && state?.key !== key;
  const slots = state?.key === key ? state.slots : [];

  if (!key) return <p className={`${a.small} ${a.muted}`}>Pick a date to see open times.</p>;
  if (loading) return <p className={`${a.small} ${a.muted}`} aria-live="polite">Loading times…</p>;
  if (state?.error) return <p className={`${a.msg} ${a.msgErr}`}>{state.error}</p>;
  if (!state?.open || slots.length === 0)
    return <p className={`${a.small} ${a.muted}`}>Closed that day for this experience. Use “Type a time” to book outside opening hours.</p>;
  const anyFree = slots.some((s) => s.available);
  return (
    <div>
      {state.calendarError && <p className={`${a.notice} ${a.noticeWarn}`} style={{ marginBottom: 8 }}>Cal.com didn’t answer, so these are based on the site’s own records only.</p>}
      <div className={p.slots} role="radiogroup" aria-label="Start time">
        {slots.map((s) => {
          const selected = value === s.start;
          return (
            <label key={s.start} className={`${p.slot} ${selected ? p.slotOn : ""} ${!s.available ? p.slotOff : ""}`}>
              <input
                type="radio"
                name={name ?? "slotPick"}
                value={s.start}
                checked={selected}
                disabled={!s.available}
                onChange={() => onPick(s.start)}
                className="sr-only"
              />
              <span className={p.slotTime}>{nyTime(s.start)}</span>
              {s.reason && <span className={p.slotWhy}>{REASON[s.reason] ?? s.reason}</span>}
            </label>
          );
        })}
      </div>
      {!anyFree && <p className={`${a.small} ${a.muted}`} style={{ marginTop: 8 }}>Fully booked that day.</p>}
    </div>
  );
}
