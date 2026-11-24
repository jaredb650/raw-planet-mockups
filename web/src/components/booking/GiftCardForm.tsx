"use client";

import { Turnstile, resetTurnstile, turnstileToken } from "@/components/Turnstile";
import { useId, useRef, useState, type FormEvent } from "react";
import { formatMoney, parseDollars } from "@/lib/money";
import styles from "./pages.module.css";

type Preset = { cents: number; hint: string };
type Fields = Record<string, string>;

/** Gift card purchase: amount, from/to, delivery date, live card preview. */
export function GiftCardForm({ presets, minCents, maxCents, today }: { presets: Preset[]; minCents: number; maxCents: number; today: string }) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [choice, setChoice] = useState<string>(String(presets[1]?.cents ?? presets[0]?.cents ?? 15000));
  const [custom, setCustom] = useState("");
  const [recipient, setRecipient] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [from, setFrom] = useState("");
  const [fields, setFields] = useState<Fields>({});
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const amountCents = choice === "custom" ? parseDollars(custom) : Number(choice);

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const local: Fields = {};
    if (!amountCents || amountCents < minCents || amountCents > maxCents)
      local.amountCents = `Choose an amount between ${formatMoney(minCents)} and ${formatMoney(maxCents)}.`;
    else if (amountCents % 100 !== 0) local.amountCents = "Choose a whole-dollar amount.";
    if (String(fd.get("purchaserName") ?? "").trim().length < 2) local.purchaserName = "Tell us your name.";
    if (!/^\S+@\S+\.\S+$/.test(String(fd.get("purchaserEmail") ?? "").trim())) local.purchaserEmail = "Enter a valid email address.";
    if (Object.keys(local).length) return fail(local, "Please check the highlighted fields.");
    setSending(true);
    setFields({});
    setError(null);
    try {
      const res = await fetch("/api/gift-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          purchaserName: fd.get("purchaserName"),
          purchaserEmail: fd.get("purchaserEmail"),
          recipientName: fd.get("recipientName") || null,
          recipientEmail: fd.get("recipientEmail") || null,
          message: fd.get("message") || null,
          deliverOn: fd.get("deliverOn") || null,
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
      setSending(false);
      fail(body.fields ?? {}, body.error ?? "Something went wrong. Please try again.");
    } catch {
      setSending(false);
      setError("We couldn't reach the server. Check your connection and try again.");
    }
  }

  function fail(f: Fields, message: string) {
    setFields(f);
    setError(message);
    const first = Object.keys(f)[0];
    if (first)
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>(first === "amountCents" ? "[name=amount]:checked, [name=amount]" : `[name="${first}"]`)?.focus(),
      );
  }

  const err = (k: string) =>
    fields[k] ? (
      <p className="error" id={`${id}-${k}-e`}>
        {fields[k]}
      </p>
    ) : null;
  const inv = (k: string) => (fields[k] ? { "aria-invalid": true as const, "aria-describedby": `${id}-${k}-e` } : {});

  return (
    <div className={styles.layout}>
      <form ref={formRef} className={styles.card} onSubmit={submit} noValidate>
        <div className={styles.section}>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }} {...inv("amountCents")}>
            <legend className={styles.cardTitle}>Choose an amount</legend>
            <div className={styles.amounts}>
              {presets.map((p) => (
                <label key={p.cents} className={styles.amount}>
                  <input type="radio" name="amount" value={p.cents} checked={choice === String(p.cents)} onChange={() => setChoice(String(p.cents))} />
                  <span>
                    {formatMoney(p.cents)}
                    <small>{p.hint}</small>
                  </span>
                </label>
              ))}
              <label className={styles.amount}>
                <input type="radio" name="amount" value="custom" checked={choice === "custom"} onChange={() => setChoice("custom")} />
                <span>
                  Other
                  <small>You choose</small>
                </span>
              </label>
            </div>
            {choice === "custom" ? (
              <div className="field" style={{ marginTop: 14, maxWidth: 260 }}>
                <label htmlFor={`${id}-c`}>Amount in dollars</label>
                <input
                  id={`${id}-c`}
                  className="input"
                  inputMode="numeric"
                  placeholder={`${minCents / 100} to ${maxCents / 100}`}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  autoFocus
                  {...inv("amountCents")}
                />
              </div>
            ) : null}
            {err("amountCents")}
          </fieldset>
        </div>

        <div className={styles.section}>
          <h2 className={styles.cardTitle}>Who&rsquo;s it for?</h2>
          <div className={styles.stack}>
            <div className={styles.grid2}>
              <div className="field">
                <label htmlFor={`${id}-rn`}>
                  Their name <span className={styles.optional}>(optional)</span>
                </label>
                <input id={`${id}-rn`} name="recipientName" className="input" maxLength={120} value={recipient} onChange={(e) => setRecipient(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor={`${id}-re`}>
                  Their email <span className={styles.optional}>(optional)</span>
                </label>
                <input
                  id={`${id}-re`}
                  name="recipientEmail"
                  type="email"
                  className="input"
                  maxLength={200}
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  {...inv("recipientEmail")}
                />
                {err("recipientEmail") ?? <p className="hint">Leave blank and we&rsquo;ll send the card to you to pass on.</p>}
              </div>
            </div>
            {recipientEmail.trim() ? (
              <div className="field" style={{ maxWidth: 260 }}>
                <label htmlFor={`${id}-d`}>
                  Send it on <span className={styles.optional}>(optional)</span>
                </label>
                <input id={`${id}-d`} name="deliverOn" type="date" className="input" min={today} {...inv("deliverOn")} />
                {err("deliverOn") ?? <p className="hint">Leave empty to send it right away.</p>}
              </div>
            ) : null}
            <div className="field">
              <label htmlFor={`${id}-m`}>
                A note for them <span className={styles.optional}>(optional)</span>
              </label>
              <textarea id={`${id}-m`} name="message" className="textarea" maxLength={1000} placeholder="Happy birthday! Go make something loud." />
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.cardTitle}>From you</h2>
          <div className={styles.grid2}>
            <div className="field">
              <label htmlFor={`${id}-pn`}>Your name</label>
              <input id={`${id}-pn`} name="purchaserName" className="input" autoComplete="name" maxLength={120} value={from} onChange={(e) => setFrom(e.target.value)} {...inv("purchaserName")} />
              {err("purchaserName")}
            </div>
            <div className="field">
              <label htmlFor={`${id}-pe`}>Your email</label>
              <input id={`${id}-pe`} name="purchaserEmail" type="email" inputMode="email" className="input" autoComplete="email" maxLength={200} {...inv("purchaserEmail")} />
              {err("purchaserEmail") ?? <p className="hint">Your receipt goes here.</p>}
            </div>
          </div>
          <input name="website" tabIndex={-1} autoComplete="off" className={styles.hp} aria-hidden="true" />
        </div>

        <div className={styles.section}>
          {error ? (
            <p className="notice notice--danger" role="alert" style={{ marginBottom: 14 }}>
              {error}
            </p>
          ) : null}
          <Turnstile />
          <button type="submit" className="btn btn--accent btn--block" disabled={sending}>
            {sending ? "Opening checkout…" : `Buy gift card${amountCents && amountCents >= minCents ? ` · ${formatMoney(amountCents)}` : ""}`}
          </button>
          <p className={styles.fine} style={{ textAlign: "center", marginTop: 10 }}>
            Good for any session and never expires. Secure payment by Stripe.
          </p>
        </div>
      </form>

      <aside className={styles.aside} aria-label="Gift card preview">
        <div className={styles.giftPreview}>
          <span className={styles.gpBrand}>Raw Planet</span>
          <span className={`${styles.gpAmount} tabular`}>{amountCents && amountCents >= minCents && amountCents <= maxCents ? formatMoney(amountCents) : "$—"}</span>
          <span className={styles.gpFor}>
            {recipient.trim() ? `For ${recipient.trim()}` : "Make it loud. Make it yours."}
            {from.trim() ? ` · from ${from.trim()}` : ""}
          </span>
        </div>
        <ul className={styles.trust} style={{ marginTop: 22 }}>
          <li>Works for music production, DJ and sound meditation.</li>
          <li>Use it over several bookings; the balance carries over.</li>
          <li>Arrives by email with a code they enter at checkout.</li>
        </ul>
      </aside>
    </div>
  );
}

/** "Check a balance" mini form. */
export function GiftCardBalance() {
  const id = useId();
  const [state, setState] = useState<{ status: "idle" | "busy" | "done" | "error"; text?: string }>({ status: "idle" });
  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const code = String(new FormData(ev.currentTarget).get("code") ?? "").trim();
    if (!code) return setState({ status: "error", text: "Enter the code from your gift card." });
    setState({ status: "busy" });
    try {
      const res = await fetch(`/api/gift-cards/balance?${new URLSearchParams({ code })}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setState({ status: "error", text: body.error ?? "We couldn't check that code." });
      const text =
        body.status === "void"
          ? "This gift card is no longer valid."
          : body.balanceCents > 0
            ? `${formatMoney(body.balanceCents)} left to spend.`
            : "This gift card has been fully used.";
      setState({ status: "done", text });
    } catch {
      setState({ status: "error", text: "We couldn't reach the server. Try again." });
    }
  }
  return (
    <form onSubmit={submit} className={styles.stack} noValidate>
      <div className="field">
        <label htmlFor={`${id}-c`}>Gift card code</label>
        <div className={styles.codeRow}>
          <input id={`${id}-c`} name="code" className="input" placeholder="RAW-XXXX-XXXX-XXXX" autoComplete="off" spellCheck={false} maxLength={40} />
          <button type="submit" className="btn btn--sm" disabled={state.status === "busy"}>
            Check
          </button>
        </div>
      </div>
      <div aria-live="polite">
        {state.text ? <p className={state.status === "error" ? styles.err : styles.ok}>{state.text}</p> : null}
      </div>
    </form>
  );
}
