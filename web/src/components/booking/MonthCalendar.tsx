"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { addDays, addMonths, firstOfMonth, lastOfMonth, longDate, monthGrid, monthLabel, monthOf, type MonthKey } from "./dates";
import { dayState, type ApiDay, type DayState } from "./useAvailability";
import styles from "./booking.module.css";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DOW_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Props = {
  month: MonthKey;
  minMonth: MonthKey;
  maxMonth: MonthKey;
  onMonthChange: (m: MonthKey) => void;
  selected: string | null;
  onSelect: (dateKey: string) => void;
  days: Record<string, ApiDay>;
  loading: boolean;
  today: string;
};

function dayLabel(dateKey: string, state: DayState, day: ApiDay | undefined, today: string): string {
  const base = `${longDate(dateKey)}${dateKey === today ? ", today" : ""}`;
  if (state === "available") {
    const n = day?.available ?? 0;
    return `${base}, ${n} ${n === 1 ? "time" : "times"} open`;
  }
  if (state === "full") return `${base}, fully booked, join the waitlist`;
  return `${base}, not available`;
}

/**
 * Month grid with roving focus (WAI-ARIA date grid pattern):
 * arrows move by day/week, Home/End to the week's ends, PageUp/PageDown by month.
 * Fully booked days stay clickable so guests can join the waitlist.
 */
export function MonthCalendar(props: Props) {
  const { month, minMonth, maxMonth, onMonthChange, selected, onSelect, days, loading, today } = props;
  const headingId = useId();
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const wantFocus = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // The cell that holds tabindex=0: last focused (if in view), else the selection, else the first open day.
  const inMonth = (k: string | null): k is string => !!k && monthOf(k) === month;
  const firstOpen = Object.keys(days)
    .sort()
    .find((k) => inMonth(k) && dayState(days[k]) !== "unavailable");
  const tabKey = inMonth(focusKey) ? focusKey : inMonth(selected) ? selected : (firstOpen ?? (inMonth(today) ? today : firstOfMonth(month)));

  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${tabKey}"]`)?.focus();
  }, [tabKey, month]);

  const canPrev = month > minMonth;
  const canNext = month < maxMonth;

  function moveTo(next: string) {
    const m = monthOf(next);
    if (m < minMonth || m > maxMonth) return;
    wantFocus.current = true;
    setFocusKey(next);
    if (m !== month) onMonthChange(m);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, k: string) {
    const weekday = (new Date(`${k}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
    let next: string | null = null;
    switch (e.key) {
      case "ArrowLeft": next = addDays(k, -1); break;
      case "ArrowRight": next = addDays(k, 1); break;
      case "ArrowUp": next = addDays(k, -7); break;
      case "ArrowDown": next = addDays(k, 7); break;
      case "Home": next = addDays(k, -weekday); break;
      case "End": next = addDays(k, 6 - weekday); break;
      case "PageUp": {
        const m = addMonths(month, -1);
        const d = `${m}-${k.slice(8)}`;
        next = d > lastOfMonth(m) ? lastOfMonth(m) : d;
        break;
      }
      case "PageDown": {
        const m = addMonths(month, 1);
        const d = `${m}-${k.slice(8)}`;
        next = d > lastOfMonth(m) ? lastOfMonth(m) : d;
        break;
      }
      default: return;
    }
    e.preventDefault();
    moveTo(next);
  }

  const weeks = monthGrid(month);

  return (
    <div className={styles.cal}>
      <div className={styles.calHead}>
        <h3 id={headingId} className={styles.calMonth} aria-live="polite">
          {monthLabel(month)}
        </h3>
        <div className={styles.calNav}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => canPrev && onMonthChange(addMonths(month, -1))}
            disabled={!canPrev}
            aria-label="Previous month"
          >
            <Chevron dir="left" />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => canNext && onMonthChange(addMonths(month, 1))}
            disabled={!canNext}
            aria-label="Next month"
          >
            <Chevron dir="right" />
          </button>
        </div>
      </div>
      <div ref={gridRef} role="grid" aria-labelledby={headingId} className={styles.grid} data-loading={loading || undefined} aria-busy={loading}>
        <div role="row" className={styles.dow}>
          {DOW.map((d, i) => (
            <span role="columnheader" key={d} aria-label={DOW_LONG[i]}>
              {d}
            </span>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div role="row" className={styles.week} key={wi}>
            {week.map((k, di) => {
              if (!k) return <span role="gridcell" key={`pad-${di}`} className={styles.pad} />;
              const day = days[k];
              const state: DayState = loading && !day ? "unavailable" : dayState(day);
              const isSel = k === selected;
              const off = state === "unavailable";
              return (
                <span role="gridcell" key={k} aria-selected={isSel}>
                  <button
                    type="button"
                    data-date={k}
                    className={styles.day}
                    data-state={loading && !day ? "loading" : state}
                    data-today={k === today || undefined}
                    aria-pressed={isSel}
                    aria-disabled={off || undefined}
                    aria-label={loading && !day ? `${longDate(k)}, loading` : dayLabel(k, state, day, today)}
                    tabIndex={k === tabKey ? 0 : -1}
                    onFocus={() => setFocusKey(k)}
                    onKeyDown={(e) => onKeyDown(e, k)}
                    onClick={() => {
                      if (!off) onSelect(k);
                    }}
                  >
                    {Number(k.slice(8))}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <p className={styles.legend} aria-hidden="true">
        <span className={styles.legendItem} data-k="open">Open</span>
        <span className={styles.legendItem} data-k="full">Fully booked: join the waitlist</span>
      </p>
    </div>
  );
}

export function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
