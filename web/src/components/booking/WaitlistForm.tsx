"use client";

import { Turnstile, resetTurnstile, turnstileToken } from "@/components/Turnstile";
import { useId, useState, type FormEvent } from "react";
import { longDate } from "./dates";
import styles from "./booking.module.css";

/** Shown for a fully booked day: we email them if a time opens up. */
export function WaitlistForm({ experience, date, guests }: { experience: string; date: string; guests: number }) {
  const id = useId();
  const [state, setState] = useState<{ status: "idle" | "sending" | "done" | "error"; error?: string; fields?: Record<string, string> }>({
    status: "idle",
  });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState({ status: "sending" });
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experience,
          date,
          guests,
          name: fd.get("name"),
          email: fd.get("email"),
          website: fd.get("website"),
          turnstileToken: await turnstileToken(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        resetTurnstile();
        setState({ status: "error", error: body.error ?? "We couldn't add you. Please try again.", fields: body.fields });
        return;
      }
      setState({ status: "done" });
    } catch {
      setState({ status: "error", error: "We couldn't reach the server. Check your connection and try again." });
    }
  }

  if (state.status === "done") {
    return (
      <div className={styles.waitlist} role="status">
        <strong>You&rsquo;re on the list.</strong>
        <p>If a time opens on {longDate(date)}, we&rsquo;ll email you straight away. First to book gets it.</p>
      </div>
    );
  }

  return (
    <form className={styles.waitlist} onSubmit={submit} noValidate>
      <strong>{longDate(date)} is fully booked.</strong>
      <p>Leave your email and we&rsquo;ll tell you the moment a time opens up.</p>
      <div className={styles.waitlistFields}>
        <label className="sr-only" htmlFor={`${id}-n`}>
          Your name
        </label>
        <input
          id={`${id}-n`}
          name="name"
          className="input"
          placeholder="Your name"
          autoComplete="name"
          required
          aria-invalid={state.fields?.name ? true : undefined}
        />
        <label className="sr-only" htmlFor={`${id}-e`}>
          Your email
        </label>
        <input
          id={`${id}-e`}
          name="email"
          type="email"
          className="input"
          placeholder="Your email"
          autoComplete="email"
          required
          aria-invalid={state.fields?.email ? true : undefined}
        />
        <input name="website" tabIndex={-1} autoComplete="off" className={styles.hp} aria-hidden="true" />
      </div>
      {state.status === "error" ? (
        <p className="error small" role="alert" style={{ color: "var(--danger)", fontWeight: 600, margin: 0 }}>
          {state.error}
        </p>
      ) : null}
      <Turnstile />
      <button type="submit" className="btn btn--sm" disabled={state.status === "sending"}>
        {state.status === "sending" ? "Adding you…" : "Join the waitlist"}
      </button>
    </form>
  );
}
