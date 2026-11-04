"use client";

import { useId, useState } from "react";
import forms from "./Forms.module.css";
import styles from "./ReviewForm.module.css";

const WORDS = ["", "Not great", "It was OK", "Good", "Really good", "Loved it"];

/** Accessible 1–5 star picker: a radio group styled as stars (arrow keys work natively). */
export function StarRatingInput({ value, onChange, invalid }: { value: number; onChange: (n: number) => void; invalid?: boolean }) {
  const name = useId();
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset className={styles.stars} aria-invalid={invalid || undefined} onMouseLeave={() => setHover(0)}>
      <legend className={styles.legend}>Your rating</legend>
      <div className={styles.row}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={styles.star} data-on={n <= shown || undefined} onMouseEnter={() => setHover(n)}>
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className={styles.radio} />
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" />
            </svg>
            <span className="sr-only">
              {n} star{n === 1 ? "" : "s"}, {WORDS[n]}
            </span>
          </label>
        ))}
        <span className={styles.word} aria-hidden="true">
          {WORDS[shown]}
        </span>
      </div>
    </fieldset>
  );
}

type State = { kind: "idle" } | { kind: "sending" } | { kind: "done"; rating: number } | { kind: "error"; message: string; field?: string };

export function ReviewForm({ code, token, defaultName, experienceName }: { code: string; token: string; defaultName: string; experienceName: string }) {
  const [rating, setRating] = useState(0);
  const [state, setState] = useState<State>({ kind: "idle" });
  const id = useId();
  const err = state.kind === "error" ? state : null;

  if (state.kind === "done") {
    return (
      <div className={forms.done} role="status">
        <p className={forms.doneTitle}>Thank you!</p>
        <p>
          Alex reads every review personally. Yours will appear on the site once he&rsquo;s had a look, usually within a day or two.
        </p>
        {state.rating >= 4 ? (
          <p>
            Got a 30-second video of how it felt? We&rsquo;d love to share it.{" "}
            <a href="/contact" className="link">
              Send it our way
            </a>
            .
          </p>
        ) : (
          <p>If anything didn&rsquo;t go the way it should, reply to any of our emails. We&rsquo;d really like to make it right.</p>
        )}
      </div>
    );
  }

  return (
    <form
      className={forms.form}
      noValidate
      onSubmit={async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        const body = {
          code,
          token,
          rating,
          body: String(fd.get("body") ?? "").trim(),
          name: String(fd.get("name") ?? "").trim(),
          location: String(fd.get("location") ?? "").trim(),
        };
        if (!rating) return setState({ kind: "error", field: "rating", message: "Please pick a star rating." });
        if (body.body.length < 10) return setState({ kind: "error", field: "body", message: "A sentence or two, please (at least 10 characters)." });
        if (!body.name) return setState({ kind: "error", field: "name", message: "Please add the name to show with your review." });
        setState({ kind: "sending" });
        try {
          const res = await fetch("/api/reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
          const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; field?: string };
          if (!res.ok || !data.ok) return setState({ kind: "error", message: data.error ?? "Something went wrong. Please try again.", field: data.field });
          setState({ kind: "done", rating });
        } catch {
          setState({ kind: "error", message: "We couldn't reach the server. Check your connection and try again." });
        }
      }}
    >
      <StarRatingInput value={rating} onChange={setRating} invalid={err?.field === "rating"} />
      <div className="field">
        <label htmlFor={`${id}-body`}>How was your {experienceName.toLowerCase()} session?</label>
        <textarea
          id={`${id}-body`}
          name="body"
          className="textarea"
          rows={6}
          maxLength={3000}
          aria-invalid={err?.field === "body" || undefined}
          placeholder="What did you make? What surprised you? Would you tell a friend?"
        />
      </div>
      <div className={forms.row2}>
        <div className="field">
          <label htmlFor={`${id}-name`}>Name to show</label>
          <input id={`${id}-name`} name="name" className="input" defaultValue={defaultName} autoComplete="given-name" aria-invalid={err?.field === "name" || undefined} />
          <span className="hint">First name is perfect.</span>
        </div>
        <div className="field">
          <label htmlFor={`${id}-loc`}>
            Where you&rsquo;re from <span className="muted">(optional)</span>
          </label>
          <input id={`${id}-loc`} name="location" className="input" placeholder="e.g. Brooklyn, NY" autoComplete="address-level2" />
        </div>
      </div>
      {err ? (
        <p className="notice notice--danger" role="alert">
          {err.message}
        </p>
      ) : null}
      <div className={forms.actions}>
        <button type="submit" className="btn btn--accent" disabled={state.kind === "sending"}>
          {state.kind === "sending" ? "Sending…" : "Post my review"}
        </button>
        <p className={forms.fine}>Your email is never shown. Reviews appear after Alex reads them.</p>
      </div>
    </form>
  );
}
