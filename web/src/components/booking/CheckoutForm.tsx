"use client";

import { Turnstile, resetTurnstile, turnstileToken } from "@/components/Turnstile";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { PublicExperience } from "@/lib/queries/public";
import type { QuoteLine } from "@/lib/booking/pricing";
import { formatMoney } from "@/lib/money";
import { fmtDuration, fmtTimeRange } from "@/lib/time";
import { longDate } from "./dates";
import { GuestStepper } from "./GuestStepper";
import { cancellationLine, displayQuote, groupHint, guestsLabel, themeOf } from "./format";
import styles from "./pages.module.css";

type QuoteView = { totalCents: number; lines: QuoteLine[] };
type Fields = Record<string, string>;

const OCCASIONS = [
  { value: "birthday", label: "Birthday" },
  { value: "date", label: "Date" },
  { value: "team", label: "Team outing" },
  { value: "just_because", label: "Just because" },
  { value: "other", label: "Something else" },
] as const;

/**
 * Guest details + live price. Re-quotes on the server whenever guests,
 * add-ons or codes change; the server re-quotes again at checkout.
 */
export function CheckoutForm({
  experience: e,
  date,
  start,
  end,
  duration,
  initialGuests,
  adjustPercent,
}: {
  experience: PublicExperience;
  date: string;
  start: string;
  end: string;
  duration: number;
  initialGuests: number;
  /** Smart pricing for this slot, so the first paint already shows the real price. */
  adjustPercent?: number;
}) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [guests, setGuests] = useState(initialGuests);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [promoInput, setPromoInput] = useState("");
  const [giftInput, setGiftInput] = useState("");
  const [promo, setPromo] = useState<string | null>(null);
  const [giftCode, setGiftCode] = useState<string | null>(null);
  const [isGift, setIsGift] = useState(false);
  const [quote, setQuote] = useState<{ key: string; view: QuoteView; promoError: string | null; giftCardError: string | null } | null>(null);
  const [fields, setFields] = useState<Fields>({});
  const [formError, setFormError] = useState<{ message: string; taken?: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [spanish, setSpanish] = useState(false);

  const [requote, setRequote] = useState(0);

  const quoteKey = JSON.stringify([guests, addonIds, promo, giftCode, requote]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({ experience: e.slug, start, duration, guests, addonIds, promoCode: promo, giftCardCode: giftCode }),
    })
      .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
      .then(({ ok, body }) => {
        if (!ok || !body.quote) return;
        setQuote({ key: quoteKey, view: body.quote, promoError: body.promoError ?? null, giftCardError: body.giftCardError ?? null });
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [quoteKey, e.slug, start, duration, guests, addonIds, promo, giftCode]);

  // Until the server answers, show the local estimate (codes not applied yet).
  const local = displayQuote(e, duration, guests, adjustPercent);
  const fresh = quote?.key === quoteKey ? quote : null;
  const view: QuoteView | null = fresh?.view ?? quote?.view ?? (local ? { totalCents: local.totalCents, lines: local.lines } : null);
  const promoError = promo && fresh ? fresh.promoError : null;
  const giftError = giftCode && fresh ? fresh.giftCardError : null;
  const total = view?.totalCents ?? 0;
  const theme = themeOf(e);
  const changeHref = `/book/${e.slug}?${new URLSearchParams({ date, duration: String(duration), guests: String(guests) })}`;

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const local: Fields = {};
    if (String(fd.get("name") ?? "").trim().length < 2) local.name = "Tell us your name.";
    if (!/^\S+@\S+\.\S+$/.test(String(fd.get("email") ?? "").trim())) local.email = "Enter a valid email address.";
    if (isGift && !String(fd.get("giftRecipientName") ?? "").trim()) local.giftRecipientName = "Who's the gift for?";
    if (!fd.get("acceptPolicies")) local.acceptPolicies = "Please agree to the booking policies.";
    if (Object.keys(local).length) {
      setFields(local);
      setFormError({ message: "Please check the highlighted fields." });
      focusFirst(local);
      return;
    }
    setSubmitting(true);
    setFields({});
    setFormError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experience: e.slug,
          start,
          duration,
          guests,
          expectedTotalCents: fresh?.view.totalCents,
          addonIds,
          promoCode: promo,
          giftCardCode: giftCode,
          name: fd.get("name"),
          email: fd.get("email"),
          phone: fd.get("phone") || null,
          language: fd.get("language") === "es" ? "es" : "en",
          occasion: fd.get("occasion") || null,
          notes: fd.get("notes") || null,
          marketingOptIn: Boolean(fd.get("marketingOptIn")),
          acceptPolicies: Boolean(fd.get("acceptPolicies")),
          isGift,
          giftRecipientName: isGift ? fd.get("giftRecipientName") : null,
          giftRecipientEmail: isGift ? fd.get("giftRecipientEmail") || null : null,
          giftMessage: isGift ? fd.get("giftMessage") || null : null,
          website: fd.get("website") || null,
          turnstileToken: await turnstileToken(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.url) {
        window.location.assign(body.url);
        return;
      }
      resetTurnstile();
      setSubmitting(false);
      if (body.code === "price_changed") setRequote((n) => n + 1);
      if (body.fields) {
        setFields(body.fields);
        focusFirst(body.fields);
      }
      setFormError({
        message: body.error ?? "Something went wrong. Please try again.",
        taken: res.status === 409 || body.code === "slot_unavailable",
      });
    } catch {
      setSubmitting(false);
      setFormError({ message: "We couldn't reach the server. Check your connection and try again." });
    }
  }

  function focusFirst(f: Fields) {
    const first = Object.keys(f)[0];
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus());
  }

  const err = (name: string) =>
    fields[name] ? (
      <p className={styles.err} id={`${id}-${name}-err`}>
        {fields[name]}
      </p>
    ) : null;
  const invalid = (name: string) =>
    fields[name] ? { "aria-invalid": true as const, "aria-describedby": `${id}-${name}-err` } : {};

  return (
    <div className={`${styles.layout} ${styles.summaryFirst}`}>
      <form ref={formRef} onSubmit={submit} noValidate aria-describedby={formError ? `${id}-formerr` : undefined}>
        <div className={styles.card}>
          <div className={styles.section}>
            <h2 className={styles.cardTitle}>Who&rsquo;s coming?</h2>
            <GuestStepper value={guests} min={e.minGuests} max={e.maxGuests} onChange={setGuests} label="Guests" hint={groupHint(e)} />
          </div>

          <div className={styles.section}>
            <h2 className={styles.cardTitle}>Contact details</h2>
            <div className={styles.stack}>
              <div className="field">
                <label htmlFor={`${id}-name`}>Full name</label>
                <input id={`${id}-name`} name="name" className="input" autoComplete="name" required maxLength={120} {...invalid("name")} />
                {err("name")}
              </div>
              <div className={styles.grid2}>
                <div className="field">
                  <label htmlFor={`${id}-email`}>Email</label>
                  <input
                    id={`${id}-email`}
                    name="email"
                    type="email"
                    inputMode="email"
                    className="input"
                    autoComplete="email"
                    required
                    maxLength={200}
                    {...invalid("email")}
                  />
                  {err("email") ?? <p className="hint">Your confirmation and manage link go here.</p>}
                </div>
                <div className="field">
                  <label htmlFor={`${id}-phone`}>
                    Phone <span className={styles.optional}>(optional)</span>
                  </label>
                  <input id={`${id}-phone`} name="phone" type="tel" inputMode="tel" className="input" autoComplete="tel" maxLength={40} {...invalid("phone")} />
                  {err("phone") ?? <p className="hint">Only used if we need to reach you on the day.</p>}
                </div>
              </div>
              <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="label" style={{ marginBottom: 8 }}>
                  Session language
                </legend>
                <div className={styles.choiceRow}>
                  <label className={styles.choice}>
                    <input type="radio" name="language" value="en" defaultChecked onChange={() => setSpanish(false)} />
                    <span>English</span>
                  </label>
                  <label className={styles.choice}>
                    <input type="radio" name="language" value="es" onChange={() => setSpanish(true)} />
                    <span lang="es">Español</span>
                  </label>
                </div>
              </fieldset>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.cardTitle}>
              Anything we should know? <span className={styles.optional}>(optional)</span>
            </h2>
            <div className={styles.stack}>
              <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="label" style={{ marginBottom: 8 }}>
                  What&rsquo;s the occasion?
                </legend>
                <div className={styles.choiceRow}>
                  {OCCASIONS.map((o) => (
                    <label key={o.value} className={styles.choice}>
                      <input type="radio" name="occasion" value={o.value} />
                      <span>{o.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="field">
                <label htmlFor={`${id}-notes`}>Notes for Alex</label>
                <textarea
                  id={`${id}-notes`}
                  name="notes"
                  className="textarea"
                  maxLength={2000}
                  placeholder="Music you love, songs you'd like to sample, accessibility needs…"
                  {...invalid("notes")}
                />
                {err("notes")}
              </div>
            </div>
          </div>

          {e.addons.length ? (
            <div className={styles.section}>
              <h2 className={styles.cardTitle}>Make it extra</h2>
              <div className={styles.stack}>
                {e.addons.map((a) => (
                  <label key={a.id} className={styles.addon}>
                    <input
                      type="checkbox"
                      checked={addonIds.includes(a.id)}
                      onChange={(ev) =>
                        setAddonIds((ids) => (ev.target.checked ? [...ids, a.id] : ids.filter((x) => x !== a.id)))
                      }
                    />
                    <span>
                      <strong>{a.name}</strong>
                      {a.description}
                    </span>
                    <b>
                      {formatMoney(a.priceCents)}
                      {a.pricing === "per_guest" ? " pp" : ""}
                    </b>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className={styles.section}>
            <label className="check">
              <input type="checkbox" checked={isGift} onChange={(ev) => setIsGift(ev.target.checked)} />
              <span>
                <strong>This session is a gift</strong>
                <br />
                <span className="muted small">
                  We&rsquo;ll email them a card with the date and time. They can move it if it doesn&rsquo;t suit.
                </span>
              </span>
            </label>
            {isGift ? (
              <div className={styles.giftBox} style={{ marginTop: 16 }}>
                <div className={styles.grid2}>
                  <div className="field">
                    <label htmlFor={`${id}-grn`}>Their name</label>
                    <input id={`${id}-grn`} name="giftRecipientName" className="input" maxLength={120} {...invalid("giftRecipientName")} />
                    {err("giftRecipientName")}
                  </div>
                  <div className="field">
                    <label htmlFor={`${id}-gre`}>
                      Their email <span className={styles.optional}>(optional)</span>
                    </label>
                    <input id={`${id}-gre`} name="giftRecipientEmail" type="email" className="input" maxLength={200} {...invalid("giftRecipientEmail")} />
                    {err("giftRecipientEmail") ?? <p className="hint">Leave blank to hand it over yourself.</p>}
                  </div>
                </div>
                <div className="field">
                  <label htmlFor={`${id}-gm`}>
                    A note for them <span className={styles.optional}>(optional)</span>
                  </label>
                  <textarea id={`${id}-gm`} name="giftMessage" className="textarea" maxLength={1000} style={{ minHeight: 80 }} />
                </div>
              </div>
            ) : null}
          </div>

          <div className={styles.section}>
            <details className={styles.disclosure}>
              <summary>Promo code or gift card</summary>
              <div className={styles.stack}>
                <CodeField
                  label="Promo code"
                  value={promoInput}
                  onChange={setPromoInput}
                  applied={promo}
                  error={promoError}
                  checking={Boolean(promo) && !fresh}
                  onApply={() => setPromo(promoInput.trim() || null)}
                  onRemove={() => {
                    setPromo(null);
                    setPromoInput("");
                  }}
                />
                <CodeField
                  label="Gift card"
                  value={giftInput}
                  onChange={setGiftInput}
                  applied={giftCode}
                  error={giftError}
                  checking={Boolean(giftCode) && !fresh}
                  placeholder="RAW-XXXX-XXXX-XXXX"
                  onApply={() => setGiftCode(giftInput.trim() || null)}
                  onRemove={() => {
                    setGiftCode(null);
                    setGiftInput("");
                  }}
                />
              </div>
            </details>
          </div>

          <div className={styles.section}>
            <div className={styles.stack}>
              <label className="check">
                <input type="checkbox" name="acceptPolicies" value="1" {...invalid("acceptPolicies")} />
                <span className="small">
                  I agree to the{" "}
                  <Link href="/policies" className="link" target="_blank">
                    booking and cancellation policy
                  </Link>
                  . {cancellationLine(e)}
                </span>
              </label>
              {err("acceptPolicies")}
              <label className="check">
                <input type="checkbox" name="marketingOptIn" value="1" />
                <span className="small muted" lang={spanish ? "es" : undefined}>
                  {spanish ? "Envíame de vez en cuando novedades sobre sesiones y encuentros de la comunidad." : "Send me the occasional note about new sessions and community meetups."}
                </span>
              </label>
              <input name="website" tabIndex={-1} autoComplete="off" className={styles.hp} aria-hidden="true" />

              {formError ? (
                <div className="notice notice--danger" role="alert" id={`${id}-formerr`}>
                  {formError.message}
                  {formError.taken ? (
                    <>
                      {" "}
                      <Link href={changeHref} className="link">
                        Pick another time
                      </Link>
                    </>
                  ) : null}
                </div>
              ) : null}

              <Turnstile />
              <button type="submit" className="btn btn--accent btn--block" data-theme={theme} disabled={submitting}>
                {submitting ? "Holding your spot…" : total === 0 && view ? "Confirm booking" : `Continue to payment · ${formatMoney(total)}`}
              </button>
              <p className={styles.fine} style={{ textAlign: "center" }}>
                {total === 0 && view
                  ? "Nothing to pay. We'll confirm straight away."
                  : "We hold your time for 30 minutes while you pay securely with Stripe."}
              </p>
            </div>
          </div>
        </div>
      </form>

      <aside className={styles.aside} aria-label="Booking summary">
        <div className={styles.summary} data-theme={theme}>
          <div className={styles.summaryTop}>
            <h2>{e.shortName}</h2>
            <p>{e.tagline}</p>
          </div>
          <div className={styles.summaryBody}>
            <dl className={styles.facts}>
              <div>
                <dt>
                  <IconCal />
                  <span className="sr-only">Date</span>
                </dt>
                <dd>
                  {longDate(date)}
                  <small>
                    {fmtTimeRange(start, end)} · New York time
                  </small>
                </dd>
              </div>
              <div>
                <dt>
                  <IconClock />
                  <span className="sr-only">Length</span>
                </dt>
                <dd>{fmtDuration(duration)}</dd>
              </div>
              <div>
                <dt>
                  <IconPeople />
                  <span className="sr-only">Guests</span>
                </dt>
                <dd>{guestsLabel(guests)}</dd>
              </div>
              <div>
                <dt>
                  <IconPin />
                  <span className="sr-only">Where</span>
                </dt>
                <dd>
                  {e.locationArea}
                  <small>Exact address in your confirmation email.</small>
                </dd>
              </div>
            </dl>
            <Link href={changeHref} className="link small">
              Change date or time
            </Link>
            {view ? (
              <ul className={styles.lines} aria-live="polite">
                {view.lines.map((l, i) => (
                  <li key={i} data-neg={l.amountCents < 0 || undefined}>
                    <span>{l.label}</span>
                    <span className="tabular">
                      {l.amountCents < 0 ? "−" : ""}
                      {formatMoney(Math.abs(l.amountCents))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className={styles.totalRow}>
              <span>Total</span>
              <strong className="tabular">{view ? formatMoney(total) : "—"}</strong>
            </div>
            <ul className={styles.trust}>
              <li>
                <IconCheck />
                {cancellationLine(e)}
              </li>
              <li>
                <IconCheck />
                Move your session online, up to twice.
              </li>
              <li>
                <IconCheck />
                Secure payment by Stripe. We never see your card.
              </li>
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}

function CodeField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  applied: string | null;
  error: string | null;
  checking: boolean;
  placeholder?: string;
  onApply: () => void;
  onRemove: () => void;
}) {
  const id = useId();
  const ok = props.applied && !props.error && !props.checking;
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      <div className={styles.codeRow}>
        <input
          id={id}
          className="input"
          value={props.value}
          placeholder={props.placeholder ?? "Enter code"}
          autoComplete="off"
          spellCheck={false}
          maxLength={40}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={`${id}-s`}
          onChange={(ev) => props.onChange(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              props.onApply();
            }
          }}
          readOnly={Boolean(ok)}
        />
        {props.applied ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={props.onRemove}>
            Remove
          </button>
        ) : (
          <button type="button" className="btn btn--ghost btn--sm" onClick={props.onApply} disabled={!props.value.trim()}>
            Apply
          </button>
        )}
      </div>
      <div id={`${id}-s`} aria-live="polite">
        {props.error ? (
          <p className={styles.err}>{props.error}</p>
        ) : props.checking ? (
          <p className={styles.fine}>Checking…</p>
        ) : ok ? (
          <p className={styles.ok}>Applied.</p>
        ) : null}
      </div>
    </div>
  );
}

const icon = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
function IconCal() {
  return (
    <svg {...icon}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg {...icon}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconPeople() {
  return (
    <svg {...icon}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.8a3.3 3.3 0 0 1 0 6.4M18 14.8c1.7.7 2.9 2.4 3.5 5.2" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg {...icon}>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg {...icon} width={16} height={16} strokeWidth={3}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
