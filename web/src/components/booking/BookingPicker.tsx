"use client";

import Link from "next/link";
import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import type { PublicExperience } from "@/lib/queries/public";
import { BUSINESS } from "@/lib/config";
import { formatMoney } from "@/lib/money";
import { fmtTimeRange } from "@/lib/time";
import { addDays, addMonths, monthOf, shortDate, todayKey, type MonthKey } from "./dates";
import { dayState, useAvailability } from "./useAvailability";
import { MonthCalendar } from "./MonthCalendar";
import { SlotPicker } from "./SlotPicker";
import { GuestStepper } from "./GuestStepper";
import { WaitlistForm } from "./WaitlistForm";
import {
  cancellationLine,
  clampGuests,
  defaultGuests,
  displayQuote,
  durationChip,
  fromPriceLabel,
  groupHint,
  guestsLabel,
  slotPriceCopy,
  sortedDurations,
  themeOf,
} from "./format";
import styles from "./booking.module.css";

export type BookingPickerProps = {
  experiences: PublicExperience[];
  initialSlug?: string;
  compact?: boolean;
  initialDate?: string;
  initialDuration?: number;
  initialGuests?: number;
  /** Banner above the picker, e.g. "Your spot was released". */
  notice?: ReactNode;
  /** Label of the continue button. */
  ctaLabel?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Experience tabs → month calendar → start times → guests → continue.
 * Picks the first open day automatically and skips ahead to the next month
 * when the current one is fully booked. Continue goes to /book/[slug].
 */
export function BookingPicker({
  experiences,
  initialSlug,
  compact = false,
  initialDate,
  initialDuration,
  initialGuests,
  notice,
  ctaLabel = "Continue",
}: BookingPickerProps) {
  const uid = useId();
  const list = useMemo(() => {
    if (compact && initialSlug) {
      const only = experiences.filter((e) => e.slug === initialSlug);
      if (only.length) return only;
    }
    return experiences;
  }, [experiences, compact, initialSlug]);

  const today = todayKey();
  const first = list.find((e) => e.slug === initialSlug) ?? list[0];
  const [slug, setSlug] = useState(first?.slug ?? "");
  const exp = list.find((e) => e.slug === slug) ?? first;

  const [duration, setDuration] = useState(() => {
    if (!first) return 0;
    const opts = sortedDurations(first);
    return opts.some((o) => o.minutes === initialDuration) ? initialDuration! : opts[0].minutes;
  });
  const [guests, setGuests] = useState(() => (first ? (initialGuests ? clampGuests(first, initialGuests) : defaultGuests(first)) : 1));
  const validInitial = initialDate && DATE_RE.test(initialDate) && initialDate >= today ? initialDate : null;
  const [month, setMonth] = useState<MonthKey>(monthOf(validInitial ?? today));
  const [pickedDate, setPickedDate] = useState<string | null>(validInitial);
  const [pickedStart, setPickedStart] = useState<string | null>(null);

  // Auto-advance past fully closed months, but only until the guest navigates themselves.
  const [auto, setAuto] = useState({ hops: 0, navigated: Boolean(validInitial) });

  const minMonth = monthOf(today);
  const maxMonth = exp ? monthOf(addDays(today, exp.maxAdvanceDays)) : minMonth;

  const avail = useAvailability({ slug: exp?.slug ?? null, duration, month });
  const loading = avail.status === "loading" || avail.status === "idle";

  // Adjusting state during render (not in an effect) so the skip happens before paint.
  if (avail.status === "ready" && !auto.navigated && auto.hops < 3 && month < maxMonth) {
    const anyOpen = Object.values(avail.days).some((d) => dayState(d) !== "unavailable");
    if (!anyOpen) {
      setAuto({ ...auto, hops: auto.hops + 1 });
      setMonth(addMonths(month, 1));
    }
  }

  // Derived selection: keep the guest's pick while it's still valid, otherwise the first open day.
  const sortedDays = Object.keys(avail.days).sort();
  const pickedState = pickedDate && monthOf(pickedDate) === month ? dayState(avail.days[pickedDate]) : "unavailable";
  const date =
    avail.status === "ready"
      ? pickedState !== "unavailable"
        ? pickedDate
        : (sortedDays.find((k) => dayState(avail.days[k]) === "available") ?? null)
      : pickedDate && monthOf(pickedDate) === month
        ? pickedDate
        : null;
  const day = date ? avail.days[date] : undefined;
  const state = day ? dayState(day) : "unavailable";
  const start = pickedStart && day?.slots.some((s) => s.start === pickedStart && s.available) ? pickedStart : null;
  const startSlot = start ? day?.slots.find((s) => s.start === start) : undefined;

  if (!exp) return <p className="muted">No experiences are open for booking right now.</p>;

  const theme = themeOf(exp);
  const durations = sortedDurations(exp);
  const quote = displayQuote(exp, duration, guests, startSlot?.adjustPercent);
  // When any open time today differs from list price, every time shows its real price up front.
  const openSlots = day?.slots.filter((s) => s.available) ?? [];
  const priced = openSlots.some((s) => s.adjustPercent);
  const copy = slotPriceCopy(guests);
  const slotSubtotal = (adjustPercent?: number) => displayQuote(exp, duration, guests, adjustPercent)?.subtotalCents ?? null;
  const fromCents = priced && !start ? Math.min(...openSlots.map((s) => slotSubtotal(s.adjustPercent) ?? Infinity)) : null;

  function selectExperience(next: PublicExperience) {
    if (next.slug === slug) return;
    setSlug(next.slug);
    const opts = sortedDurations(next);
    if (!opts.some((o) => o.minutes === duration)) setDuration(opts[0].minutes);
    setGuests((g) => (g < next.minGuests || g > next.maxGuests ? defaultGuests(next) : g));
    setPickedStart(null);
    setAuto({ hops: 0, navigated: Boolean(pickedDate) });
  }

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    let n = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % list.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + list.length) % list.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = list.length - 1;
    else return;
    e.preventDefault();
    selectExperience(list[n]);
    document.getElementById(`${uid}-tab-${list[n].slug}`)?.focus();
  }

  const timeText = startSlot ? fmtTimeRange(startSlot.start, startSlot.end) : null;
  let summary: string;
  if (!date) summary = loading ? "Finding open times…" : "Choose a day, then a time.";
  else if (state === "full") summary = `${shortDate(date)} is fully booked. Join the waitlist or pick another day.`;
  else if (!start) summary = `${exp.shortName}, ${shortDate(date)}. Now pick a time.`;
  else summary = `${exp.shortName}, ${shortDate(date)}, ${timeText}, ${guestsLabel(guests)}`;

  const href =
    date && start
      ? `/book/${exp.slug}?${new URLSearchParams({ date, start, duration: String(duration), guests: String(guests) })}`
      : null;

  const multi = list.length > 1;
  const panelId = `${uid}-panel`;

  return (
    <div className={styles.root} data-theme={theme} data-compact={compact || undefined}>
      {notice ? <div className={`notice notice--warning ${styles.banner}`}>{notice}</div> : null}
      {multi ? (
        <div className={styles.tabs} role="tablist" aria-label="Experience">
          {list.map((e, i) => (
            <button
              key={e.slug}
              id={`${uid}-tab-${e.slug}`}
              type="button"
              role="tab"
              data-theme={themeOf(e)}
              className={styles.tab}
              aria-selected={e.slug === exp.slug}
              aria-controls={panelId}
              tabIndex={e.slug === exp.slug ? 0 : -1}
              onClick={() => selectExperience(e)}
              onKeyDown={(ev) => onTabKey(ev, i)}
            >
              <span>
                {e.shortName}
                <small>
                  {fromPriceLabel(e)}
                  {e.isPlaceholder ? (
                    <>
                      {" "}
                      <span className="tag-ph">to confirm</span>
                    </>
                  ) : null}
                </small>
              </span>
              <span className={styles.sw} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.single}>
          <div>
            <strong>{exp.shortName}</strong>
            <span className="muted small">
              {" "}
              · {fromPriceLabel(exp)}
            </span>
          </div>
          {exp.isPlaceholder ? <span className="tag-ph">details to confirm</span> : null}
        </div>
      )}

      <div
        className={styles.body}
        id={panelId}
        role={multi ? "tabpanel" : undefined}
        aria-labelledby={multi ? `${uid}-tab-${exp.slug}` : undefined}
      >
        <MonthCalendar
          month={month}
          minMonth={minMonth}
          maxMonth={maxMonth}
          onMonthChange={(m) => {
            setAuto((a) => ({ ...a, navigated: true }));
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

        <div className={styles.side}>
          {durations.length > 1 ? (
            <div>
              <h4 className={styles.sideTitle} id={`${uid}-dur`}>
                How long?
              </h4>
              <div className={styles.chips} role="group" aria-labelledby={`${uid}-dur`}>
                {durations.map((o) => {
                  const c = durationChip(exp, o.minutes);
                  return (
                    <button
                      key={o.minutes}
                      type="button"
                      className={styles.chip}
                      aria-pressed={o.minutes === duration}
                      onClick={() => {
                        setDuration(o.minutes);
                        setPickedStart(null);
                      }}
                    >
                      {c.title}
                      <small>{c.price}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {avail.status === "error" ? (
            <div className="notice notice--danger" role="alert">
              {avail.error}{" "}
              <button type="button" className={`link ${styles.linkBtn}`} onClick={avail.reload}>
                Try again
              </button>
            </div>
          ) : null}
          {avail.calendarError ? (
            <p className={`notice ${styles.softNotice}`}>
              We couldn&rsquo;t double-check the live calendar just now. We confirm your time again at checkout.
            </p>
          ) : null}

          {date && state === "full" ? (
            <WaitlistForm key={`${exp.slug}-${date}`} experience={exp.slug} date={date} guests={guests} />
          ) : (
            <SlotPicker
              slots={day?.slots ?? []}
              selected={start}
              onSelect={setPickedStart}
              loading={loading}
              priceOf={
                priced
                  ? (s) => {
                      const cents = slotSubtotal(s.adjustPercent);
                      return cents === null ? null : { price: formatMoney(cents), label: (s.adjustPercent ?? 0) < 0 ? copy.offPeak : undefined };
                    }
                  : undefined
              }
              priceNote={priced ? copy.note : undefined}
              emptyText={
                avail.status === "ready" && !date
                  ? "No open times this month. Try the next one."
                  : "Pick a day on the calendar to see what's open."
              }
            />
          )}

          <GuestStepper
            value={guests}
            min={exp.minGuests}
            max={exp.maxGuests}
            onChange={setGuests}
            hint={groupHint(exp)}
          />

          <div className={styles.summary} data-sticky={!compact || undefined}>
            <div className={styles.summaryLine} aria-live="polite">
              {summary}
            </div>
            <div className={styles.total}>
              <span>
                {fromCents === null ? "Total" : "From"}
                {quote && exp.pricingMode === "per_person" && guests > 1 && !priced ? (
                  <small className="muted">
                    {" "}
                    {formatMoney(quote.baseCents / guests)} × {guests}
                  </small>
                ) : null}
              </span>
              <strong className="tabular">{quote ? formatMoney(fromCents ?? quote.subtotalCents) : "—"}</strong>
            </div>
            {href ? (
              <Link href={href} className={`btn btn--accent btn--block ${styles.cta}`}>
                {ctaLabel}
              </Link>
            ) : (
              <button type="button" className={`btn btn--accent btn--block ${styles.cta}`} disabled>
                {ctaLabel}
              </button>
            )}
            <p className={styles.fine}>
              {cancellationLine(exp)} You won&rsquo;t be charged until the next step. Secure payment by Stripe.
            </p>
            <p className={styles.rating}>
              <span aria-hidden="true">★</span> {BUSINESS.airbnbRating.score.toFixed(2)} from {BUSINESS.airbnbRating.count} Airbnb
              reviews · <Link href="/gift-cards" className="link">Gift cards</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
