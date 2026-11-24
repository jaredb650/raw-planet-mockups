"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { Turnstile, resetTurnstile, turnstileEnabled, turnstileToken } from "@/components/Turnstile";
import styles from "./pages.module.css";

type State = { status: "idle" | "sent" | "error"; message: string | null };

export function ManageFinder({ action }: { action: (prev: State, form: FormData) => Promise<State> }) {
  const id = useId();
  const [state, formAction, pending] = useActionState(action, { status: "idle", message: null });
  const waited = useRef(false);
  useEffect(() => {
    if (state.status === "error") resetTurnstile(); // token was used up
  }, [state]);

  if (state.status === "sent") {
    return (
      <div className="notice notice--success" role="status">
        <strong>Check your inbox.</strong> If we have bookings for that email, we&rsquo;ve just sent a link to each one. It can
        take a minute to arrive, so check spam too.
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className={styles.stack}
      noValidate
      onSubmit={(e) => {
        // A fast submit can beat the invisible check: hold it until the token is there (once).
        const form = e.currentTarget;
        const has = form.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]')?.value;
        if (!turnstileEnabled || has || waited.current) return void (waited.current = false);
        e.preventDefault();
        waited.current = true;
        void turnstileToken().then(() => form.requestSubmit());
      }}
    >
      <div className="field">
        <label htmlFor={`${id}-e`}>Email you booked with</label>
        <input
          id={`${id}-e`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          className="input"
          required
          aria-invalid={state.status === "error" || undefined}
          aria-describedby={state.message ? `${id}-err` : undefined}
        />
        {state.message ? (
          <p className="error" id={`${id}-err`} role="alert">
            {state.message}
          </p>
        ) : null}
      </div>
      <input name="website" tabIndex={-1} autoComplete="off" className={styles.hp} aria-hidden="true" />
      <Turnstile />
      <button type="submit" className="btn btn--accent" disabled={pending}>
        {pending ? "Sending…" : "Email me my booking links"}
      </button>
    </form>
  );
}
