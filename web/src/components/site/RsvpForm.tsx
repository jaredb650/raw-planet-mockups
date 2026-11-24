"use client";

import { Turnstile, resetTurnstile, turnstileToken } from "@/components/Turnstile";
import { useId, useState } from "react";
import styles from "./Forms.module.css";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "done"; already: boolean; email: string } | { kind: "error"; message: string; field?: string };

/** Free on-site RSVP for a community event. Posts to /api/events/[slug]/rsvp. */
export function RsvpForm({ slug, title, maxGuests, meetupUrl }: { slug: string; title: string; maxGuests: number; meetupUrl?: string | null }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const id = useId();

  if (state.kind === "done") {
    return (
      <div className={styles.done} role="status">
        <p className={styles.doneTitle}>{state.already ? "You're already on the list." : "You're in. See you there!"}</p>
        <p>
          {state.already
            ? `We already had an RSVP for ${state.email}.`
            : `We've sent the details for ${title} to ${state.email}.`}{" "}
          Can&rsquo;t make it after all? Reply to that email and we&rsquo;ll free up your spot.
        </p>
        {meetupUrl ? (
          <p>
            Also on Meetup?{" "}
            <a href={meetupUrl} className="link" target="_blank" rel="noopener">
              Join the group there <span className="sr-only">(opens in a new tab)</span>
            </a>{" "}
            to hear about the next one.
          </p>
        ) : null}
      </div>
    );
  }

  const err = state.kind === "error" ? state : null;
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={async (ev) => {
        ev.preventDefault();
        const form = ev.currentTarget;
        const fd = new FormData(form);
        const body = {
          name: String(fd.get("name") ?? "").trim(),
          email: String(fd.get("email") ?? "").trim(),
          guests: Number(fd.get("guests") ?? 1),
          website: String(fd.get("website") ?? ""),
        };
        if (!body.name) return setState({ kind: "error", field: "name", message: "Please add your name." });
        if (!/^\S+@\S+\.\S+$/.test(body.email)) return setState({ kind: "error", field: "email", message: "Please check your email address." });
        setState({ kind: "sending" });
        try {
          const res = await fetch(`/api/events/${encodeURIComponent(slug)}/rsvp`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...body, turnstileToken: await turnstileToken() }),
          });
          const data = (await res.json().catch(() => ({}))) as { ok?: boolean; already?: boolean; error?: string; field?: string };
          if (!res.ok || !data.ok) {
            resetTurnstile();
            setState({ kind: "error", message: data.error ?? "Something went wrong. Please try again.", field: data.field });
            return;
          }
          setState({ kind: "done", already: Boolean(data.already), email: body.email });
        } catch {
          setState({ kind: "error", message: "We couldn't reach the server. Check your connection and try again." });
        }
      }}
    >
      <div className={styles.row2}>
        <div className="field">
          <label htmlFor={`${id}-name`}>Your name</label>
          <input id={`${id}-name`} name="name" className="input" autoComplete="name" required aria-invalid={err?.field === "name" || undefined} />
        </div>
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
            aria-invalid={err?.field === "email" || undefined}
          />
        </div>
      </div>
      {maxGuests > 1 ? (
        <div className={`field ${styles.narrow}`}>
          <label htmlFor={`${id}-guests`}>How many of you?</label>
          <select id={`${id}-guests`} name="guests" className="select" defaultValue="1">
            {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "Just me" : `${n} people`}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="guests" value="1" />
      )}
      <div className={styles.hp} aria-hidden="true">
        <label htmlFor={`${id}-website`}>Leave this empty</label>
        <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {err ? (
        <p className="notice notice--danger" role="alert">
          {err.message}
        </p>
      ) : null}
      <div className={styles.actions}>
        <Turnstile />
        <button type="submit" className="btn btn--accent" disabled={state.kind === "sending"}>
          {state.kind === "sending" ? "Saving your spot…" : "RSVP, it's free"}
        </button>
        <p className={styles.fine}>We only use your email for this event. No newsletter unless you ask.</p>
      </div>
    </form>
  );
}
