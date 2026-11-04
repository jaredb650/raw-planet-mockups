"use client";

import { Turnstile, resetTurnstile, turnstileToken } from "@/components/Turnstile";
import { useId, useState } from "react";
import styles from "./Forms.module.css";

type Kind = "group" | "private_event" | "corporate" | "general" | "press";
type State = { kind: "idle" } | { kind: "sending" } | { kind: "done"; email: string } | { kind: "error"; message: string; field?: string };

const KIND_LABEL: Record<Kind, string> = {
  group: "Group or party",
  private_event: "Private event",
  corporate: "Company / team",
  general: "A question",
  press: "Press or collab",
};

/**
 * Contact + group request form. Posts JSON to /api/inquiries. `variant="group"`
 * asks for group size, date and experience; `"contact"` keeps it short.
 */
export function InquiryForm({
  variant,
  experiences,
  initialExperience,
}: {
  variant: "group" | "contact";
  experiences: { slug: string; shortName: string }[];
  initialExperience?: string;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const id = useId();
  const kindOptions: Kind[] = variant === "group" ? ["group", "corporate", "private_event"] : ["general", "group", "press"];
  const err = state.kind === "error" ? state : null;
  const invalid = (f: string) => (err?.field === f ? true : undefined);

  if (state.kind === "done") {
    return (
      <div className={styles.done} role="status">
        <p className={styles.doneTitle}>Got it. Thank you!</p>
        <p>
          Alex usually replies within a day, in English or Spanish. We&rsquo;ve sent a copy of your message to {state.email}; if it&rsquo;s not there,
          check your spam folder.
        </p>
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        const get = (k: string) => String(fd.get(k) ?? "").trim();
        const body = {
          kind: get("kind") || kindOptions[0],
          name: get("name"),
          email: get("email"),
          phone: get("phone"),
          experience: get("experience"),
          preferredDate: get("preferredDate"),
          groupSize: get("groupSize"),
          message: get("message"),
          website: get("website"),
        };
        if (!body.name) return setState({ kind: "error", field: "name", message: "Please add your name." });
        if (!/^\S+@\S+\.\S+$/.test(body.email)) return setState({ kind: "error", field: "email", message: "Please check your email address." });
        if (!body.message) return setState({ kind: "error", field: "message", message: "Please tell us a little about what you have in mind." });
        setState({ kind: "sending" });
        try {
          const res = await fetch("/api/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, turnstileToken: await turnstileToken() }) });
          const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; field?: string };
          if (!res.ok || !data.ok) {
            resetTurnstile();
            return setState({ kind: "error", message: data.error ?? "Something went wrong. Please try again.", field: data.field });
          }
          setState({ kind: "done", email: body.email });
        } catch {
          setState({ kind: "error", message: "We couldn't reach the server. Check your connection and try again." });
        }
      }}
    >
      {kindOptions.length > 1 ? (
        <fieldset className={styles.choices}>
          <legend>{variant === "group" ? "What are you planning?" : "What's it about?"}</legend>
          {kindOptions.map((k, i) => (
            <label key={k} className={styles.choice}>
              <input type="radio" name="kind" value={k} defaultChecked={i === 0} />
              <span>{KIND_LABEL[k]}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <input type="hidden" name="kind" value={kindOptions[0]} />
      )}

      <div className={styles.row2}>
        <div className="field">
          <label htmlFor={`${id}-name`}>Your name</label>
          <input id={`${id}-name`} name="name" className="input" autoComplete="name" aria-invalid={invalid("name")} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-email`}>Email</label>
          <input id={`${id}-email`} name="email" type="email" inputMode="email" className="input" autoComplete="email" aria-invalid={invalid("email")} />
        </div>
      </div>

      {variant === "group" ? (
        <>
          <div className={styles.row2}>
            <div className="field">
              <label htmlFor={`${id}-exp`}>Experience</label>
              <select id={`${id}-exp`} name="experience" className="select" defaultValue={initialExperience ?? ""}>
                <option value="">Not sure yet</option>
                {experiences.map((e) => (
                  <option key={e.slug} value={e.slug}>
                    {e.shortName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${id}-size`}>How many people?</label>
              <input
                id={`${id}-size`}
                name="groupSize"
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                className="input"
                aria-invalid={invalid("groupSize")}
              />
            </div>
          </div>
          <div className={styles.row2}>
            <div className="field">
              <label htmlFor={`${id}-date`}>Preferred date</label>
              <input id={`${id}-date`} name="preferredDate" className="input" placeholder="e.g. a Saturday in March" />
              <span className="hint">A rough idea is fine.</span>
            </div>
            <div className="field">
              <label htmlFor={`${id}-phone`}>
                Phone <span className="muted">(optional)</span>
              </label>
              <input id={`${id}-phone`} name="phone" type="tel" inputMode="tel" className="input" autoComplete="tel" />
            </div>
          </div>
        </>
      ) : null}

      <div className="field">
        <label htmlFor={`${id}-msg`}>{variant === "group" ? "Tell us about the occasion" : "Your message"}</label>
        <textarea
          id={`${id}-msg`}
          name="message"
          className="textarea"
          rows={5}
          aria-invalid={invalid("message")}
          placeholder={variant === "group" ? "Birthday, team day, bachelorette… anything we should know?" : undefined}
        />
      </div>

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
          {state.kind === "sending" ? "Sending…" : variant === "group" ? "Send group request" : "Send message"}
        </button>
        <p className={styles.fine}>Alex replies personally, usually within a day.</p>
      </div>
    </form>
  );
}
