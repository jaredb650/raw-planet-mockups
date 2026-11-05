"use client";

import { useEffect, useRef, useState } from "react";
import type { CampaignSegment } from "@/lib/db/schema";
import { ActionForm, SubmitButton } from "./ActionForm";
import type { FormAction } from "./types";
import a from "./admin.module.css";

/** Draft editor. The audience count re-checks on the server as the filters change, before anything is saved. */
export function CampaignEditor({
  action,
  campaign: c,
  tags,
  experiences,
}: {
  action: FormAction;
  campaign: { id: string; name: string; subject: string; body: string; segment: CampaignSegment };
  tags: string[];
  experiences: { id: string; name: string }[];
}) {
  const box = useRef<HTMLFieldSetElement>(null);
  const [count, setCount] = useState<number | null>(null);
  const [problem, setProblem] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inFlight = useRef<AbortController>(undefined);

  function refresh() {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const form = box.current?.form;
      if (!form) return;
      inFlight.current?.abort();
      const ctl = (inFlight.current = new AbortController());
      try {
        const res = await fetch("/api/admin/campaigns/count", { method: "POST", body: new FormData(form), signal: ctl.signal });
        if (!res.ok) throw new Error();
        setCount((await res.json()).count);
        setProblem(false);
      } catch {
        if (!ctl.signal.aborted) setProblem(true);
      }
    }, 300);
  }
  useEffect(() => {
    refresh();
    return () => clearTimeout(timer.current);
    // Once on mount; after that the fieldset's onChange drives it.
  }, []);

  return (
    <ActionForm action={action}>
      <input type="hidden" name="id" value={c.id} />
      <div className={a.field}>
        <label htmlFor="cp-name">Campaign name (only you see this)</label>
        <input id="cp-name" name="name" className={a.input} defaultValue={c.name} maxLength={120} required />
      </div>
      <div className={a.field}>
        <label htmlFor="cp-subject">Subject line</label>
        <input id="cp-subject" name="subject" className={a.input} defaultValue={c.subject} maxLength={150} />
      </div>
      <div className={a.field}>
        <label htmlFor="cp-body">Message</label>
        <textarea id="cp-body" name="body" className={a.textarea} rows={9} defaultValue={c.body} placeholder="Write it like a note to a friend. A blank line starts a new paragraph." />
        <span className={a.hint}>A “Book a session” button, your sign-off, the unsubscribe link and your mailing address are added for you.</span>
      </div>

      <fieldset ref={box} className={a.fieldset} onChange={refresh}>
        <legend>Who gets it</legend>
        <p className={a.hint}>Leave everything empty to reach everyone who can be emailed.</p>
        {tags.length > 0 && (
          <div className={a.field}>
            <span className={a.label}>Has any of these tags</span>
            <div className={a.row}>
              {tags.map((t) => (
                <label key={t} className={a.check}>
                  <input type="checkbox" name="tags" value={t} defaultChecked={c.segment.tags?.includes(t)} />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className={a.field}>
          <span className={a.label}>Has done any of these</span>
          <div className={a.row}>
            {experiences.map((e) => (
              <label key={e.id} className={a.check}>
                <input type="checkbox" name="experienceIds" value={e.id} defaultChecked={c.segment.experienceIds?.includes(e.id)} />
                <span>{e.name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className={a.formRow} style={{ ["--cols" as string]: 3 }}>
          <div className={a.field}>
            <label htmlFor="cp-lapsed">Last session at least (days ago)</label>
            <input id="cp-lapsed" name="lapsedDays" type="number" inputMode="numeric" min={1} className={a.input} defaultValue={c.segment.lapsedDays} placeholder="Any" />
          </div>
          <div className={a.field}>
            <label htmlFor="cp-min">At least (sessions)</label>
            <input id="cp-min" name="minSessions" type="number" inputMode="numeric" min={1} className={a.input} defaultValue={c.segment.minSessions} placeholder="Any" />
          </div>
          <div className={a.field}>
            <label htmlFor="cp-lang">Language</label>
            <select id="cp-lang" name="language" className={a.select} defaultValue={c.segment.language ?? ""}>
              <option value="">Any</option>
              <option value="en">English</option>
              <option value="es">Spanish</option>
            </select>
          </div>
        </div>
        <p role="status" aria-live="polite" className={a.strong}>
          {problem ? "Couldn’t count. Check the numbers above." : count === null ? "Counting…" : `${count} ${count === 1 ? "person" : "people"} would get this`}
        </p>
        <p className={a.hint}>Only guests who said yes to news. Never anyone who unsubscribed, or who only booked through Airbnb or Viator.</p>
      </fieldset>

      <div className={a.formFoot}>
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </div>
    </ActionForm>
  );
}
