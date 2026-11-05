"use client";

import { useId, useState } from "react";
import { WAIVER_COPY, type WaiverLang } from "@/lib/waiver";
import forms from "./Forms.module.css";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "done" } | { kind: "error"; message: string; field?: string };

export function WaiverForm({ code, token, lang, guests, signed }: { code: string; token: string; lang: WaiverLang; guests: number; signed: number }) {
  const t = WAIVER_COPY[lang].ui;
  const [state, setState] = useState<State>({ kind: "idle" });
  const [count, setCount] = useState(signed);
  const [forMinor, setForMinor] = useState(false);
  const id = useId();
  const err = state.kind === "error" ? state : null;

  if (state.kind === "done") {
    return (
      <div className={forms.done} role="status">
        <p className={forms.doneTitle}>{t.doneTitle}</p>
        <p>{t.count(count, guests)}</p>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setForMinor(false);
            setState({ kind: "idle" });
          }}
        >
          {t.doneMore}
        </button>
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
          lang,
          name: String(fd.get("name") ?? "").trim(),
          agree: fd.get("agree") === "on",
          recording: fd.get("recording") === "on",
          forMinor,
          minorName: String(fd.get("minorName") ?? "").trim(),
        };
        if (body.name.length < 2) return setState({ kind: "error", field: "name", message: t.errName });
        if (forMinor && body.minorName.length < 2) return setState({ kind: "error", field: "minorName", message: t.errMinor });
        if (!body.agree) return setState({ kind: "error", field: "agree", message: t.errAgree });
        setState({ kind: "sending" });
        try {
          const res = await fetch("/api/waivers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
          const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; field?: string; signed?: number };
          if (res.status === 429) return setState({ kind: "error", message: t.errRate });
          if (!res.ok || !data.ok) return setState({ kind: "error", message: data.error ?? t.errGeneric, field: data.field });
          setCount(data.signed ?? count);
          setState({ kind: "done" });
        } catch {
          setState({ kind: "error", message: t.errNetwork });
        }
      }}
    >
      <p style={{ fontWeight: 600, margin: 0 }}>{t.count(count, guests)}</p>
      <div className="field">
        <label htmlFor={`${id}-name`}>{t.name}</label>
        <input
          id={`${id}-name`}
          name="name"
          className="input"
          maxLength={120}
          autoComplete="name"
          aria-invalid={err?.field === "name" || undefined}
          aria-describedby={`${id}-name-hint`}
        />
        <span id={`${id}-name-hint`} className="hint">
          {t.nameHint}
        </span>
      </div>
      <label className="check">
        <input type="checkbox" checked={forMinor} onChange={(e) => setForMinor(e.target.checked)} />
        <span>{t.forMinor}</span>
      </label>
      {forMinor ? (
        <div className="field">
          <label htmlFor={`${id}-minor`}>{t.minorName}</label>
          <input
            id={`${id}-minor`}
            name="minorName"
            className="input"
            maxLength={120}
            autoComplete="off"
            aria-invalid={err?.field === "minorName" || undefined}
            aria-describedby={`${id}-minor-hint`}
          />
          <span id={`${id}-minor-hint`} className="hint">
            {t.minorHint}
          </span>
        </div>
      ) : null}
      <label className="check">
        <input type="checkbox" name="agree" aria-invalid={err?.field === "agree" || undefined} />
        <span>{t.agree}</span>
      </label>
      <label className="check">
        <input type="checkbox" name="recording" />
        <span>
          {t.recording}
          <span className="muted" style={{ display: "block", fontSize: "0.85rem" }}>
            {t.recordingHint}
          </span>
        </span>
      </label>
      {err ? (
        <p className="notice notice--danger" role="alert">
          {err.message}
        </p>
      ) : null}
      <div className={forms.actions}>
        <button type="submit" className="btn btn--accent" disabled={state.kind === "sending"}>
          {state.kind === "sending" ? t.sending : t.submit}
        </button>
      </div>
    </form>
  );
}
