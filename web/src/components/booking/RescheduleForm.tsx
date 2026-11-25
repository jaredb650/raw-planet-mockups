"use client";

import { useActionState, useState } from "react";
import { fmtTimeRange, localDateKey } from "@/lib/time";
import { addDays, monthOf, shortDate, todayKey, type MonthKey } from "./dates";
import { dayState, useAvailability } from "./useAvailability";
import { MonthCalendar } from "./MonthCalendar";
import { SlotPicker } from "./SlotPicker";
import widget from "./booking.module.css";

type State = { error: string | null };

/** Calendar + times for moving an existing booking (its own slot counts as free). */
export function RescheduleForm({
  action,
  code,
  token,
  slug,
  theme,
  duration,
  currentStart,
  maxAdvanceDays,
}: {
  action: (prev: State, form: FormData) => Promise<State>;
  code: string;
  token: string;
  slug: string;
  theme: string;
  duration: number;
  currentStart: string;
  maxAdvanceDays: number;
}) {
  const today = todayKey();
  const minMonth = monthOf(today);
  const maxMonth = monthOf(addDays(today, maxAdvanceDays));
  const currentDate = currentStart ? new Date(currentStart) : null;
  const initialMonth = (() => {
    if (!currentDate || Number.isNaN(currentDate.getTime())) return minMonth;
    const m = monthOf(localDateKey(currentDate));
    if (m < minMonth) return minMonth;
    if (m > maxMonth) return maxMonth;
    return m;
  })();
  const [month, setMonth] = useState<MonthKey>(initialMonth);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [pickedStart, setPickedStart] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [booking] = useState(() => ({ code, token }));
  const avail = useAvailability({ slug, duration, month, booking });
  const loading = avail.status !== "ready" && avail.status !== "error";

  const keys = Object.keys(avail.days).sort();
  const date =
    pickedDate && monthOf(pickedDate) === month && dayState(avail.days[pickedDate]) === "available"
      ? pickedDate
      : (keys.find((k) => dayState(avail.days[k]) === "available") ?? null);
  const day = date ? avail.days[date] : undefined;
  const slot = pickedStart ? day?.slots.find((s) => s.start === pickedStart && s.available) : undefined;
  const same = slot && currentDate && new Date(slot.start).getTime() === currentDate.getTime();

  return (
    <form action={formAction} className={widget.root} data-theme={theme}>
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="t" value={token} />
      <input type="hidden" name="start" value={slot?.start ?? ""} />
      <div className={widget.body}>
        <MonthCalendar
          month={month}
          minMonth={monthOf(today)}
          maxMonth={monthOf(addDays(today, maxAdvanceDays))}
          onMonthChange={(m) => {
            setMonth(m);
            setPickedStart(null);
          }}
          selected={date}
          onSelect={(k) => {
            setPickedDate(k);
            setPickedStart(null);
          }}
          days={avail.days}
          loading={loading}
          today={today}
        />
        <div className={widget.side}>
          <SlotPicker
            title="Pick a new start time"
            slots={day?.slots ?? []}
            selected={slot?.start ?? null}
            onSelect={setPickedStart}
            loading={loading}
            emptyText={avail.status === "ready" ? "No open times this month. Try the next one." : undefined}
            priceNote={
              day?.slots.some((s) => s.reason === "peak")
                ? "Crossed-out peak times are priced higher than your current booking — reply to your confirmation email if you'd like to upgrade."
                : undefined
            }
          />
          {avail.status === "error" ? <p className="notice notice--danger">{avail.error}</p> : null}
          <div className={widget.summary}>
            <div className={widget.summaryLine} aria-live="polite">
              {slot && date
                ? same
                  ? "That's your current time."
                  : `Move to ${shortDate(date)}, ${fmtTimeRange(slot.start, slot.end)}`
                : "Choose a day, then a time."}
            </div>
            {state.error ? (
              <p className="notice notice--danger" role="alert" style={{ margin: 0 }}>
                {state.error}
              </p>
            ) : null}
            <button type="submit" className={`btn btn--accent btn--block ${widget.cta}`} disabled={!slot || Boolean(same) || pending}>
              {pending ? "Moving your session…" : "Confirm new time"}
            </button>
            <p className={widget.fine}>Same price, nothing to pay. We&rsquo;ll email you the updated details.</p>
          </div>
        </div>
      </div>
    </form>
  );
}
