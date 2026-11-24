"use client";

import { useState } from "react";
import { ActionForm, ConfirmSubmit } from "./ActionForm";
import { CopyButton } from "./CopyButton";
import { Icon } from "./Icon";
import type { FormAction } from "./types";
import a from "./admin.module.css";

/** The host's private export feed: copy, subscribe, or regenerate. */
export function FeedLink({ initialUrl, regenerate }: { initialUrl: string; regenerate: FormAction }) {
  const [url, setUrl] = useState(initialUrl);
  const webcal = url.replace(/^https?:\/\//i, "webcal://");
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
  return (
    <div className={a.form}>
      <div className={a.field}>
        <label htmlFor="feed-url">Private link (don’t share it)</label>
        <input id="feed-url" className={`${a.input} ${a.mono}`} value={url} readOnly onFocus={(e) => e.currentTarget.select()} />
      </div>
      <div className={a.row}>
        <CopyButton text={url} label="Copy link" />
        <a className={`${a.btn} ${a.btnSm}`} href={google} target="_blank" rel="noreferrer">
          <Icon name="calendar" size={15} /> Add to Google Calendar
        </a>
        <a className={`${a.btn} ${a.btnSm}`} href={webcal}>
          <Icon name="calendar" size={15} /> iPhone / Mac
        </a>
      </div>
      <ActionForm action={regenerate} onResult={(r) => typeof r?.data?.url === "string" && setUrl(r.data.url)} className={a.row}>
        <ConfirmSubmit className={`${a.btn} ${a.btnSm} ${a.btnGhost}`} confirmLabel="Make a new link" question="The old link stops working.">
          Link leaked? Make a new one
        </ConfirmSubmit>
      </ActionForm>
    </div>
  );
}
