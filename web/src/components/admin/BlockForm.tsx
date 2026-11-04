"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "./ActionForm";
import type { FormAction } from "./types";
import a from "./admin.module.css";

export function BlockForm({
  action,
  experiences,
  defaultDate,
  idPrefix = "bl",
}: {
  action: FormAction;
  experiences: { id: string; name: string }[];
  defaultDate: string;
  idPrefix?: string;
}) {
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState(defaultDate);
  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <ActionForm action={action} resetOnSuccess onResult={(r) => r?.ok && setAllDay(false)}>
      <label className={a.check}>
        <input type="checkbox" name="allDay" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
        <span>All day</span>
      </label>
      <div className={a.formRow}>
        <div className={a.field}>
          <label htmlFor={id("sd")}>{allDay ? "First day" : "Date"}</label>
          <input id={id("sd")} name="startDate" type="date" className={a.input} value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        {allDay ? (
          <div className={a.field}>
            <label htmlFor={id("ed")}>Last day</label>
            <input id={id("ed")} name="endDate" type="date" className={a.input} min={start} placeholder="Same day" />
          </div>
        ) : (
          <div className={a.formRow} style={{ gap: 8 }}>
            <div className={a.field}>
              <label htmlFor={id("st")}>From</label>
              <input id={id("st")} name="startTime" type="time" step={900} className={a.input} defaultValue="10:00" required />
            </div>
            <div className={a.field}>
              <label htmlFor={id("et")}>To</label>
              <input id={id("et")} name="endTime" type="time" step={900} className={a.input} defaultValue="14:00" required />
            </div>
          </div>
        )}
      </div>
      <div className={a.formRow}>
        <div className={a.field}>
          <label htmlFor={id("rs")}>Reason (only you see it)</label>
          <input id={id("rs")} name="reason" className={a.input} placeholder="Viator booking, gig, day off…" maxLength={200} />
        </div>
        <div className={a.field}>
          <label htmlFor={id("ex")}>Blocks</label>
          <select id={id("ex")} name="experienceId" className={a.select} defaultValue="">
            <option value="">Everything</option>
            {experiences.map((e) => (
              <option key={e.id} value={e.id}>
                Only {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={a.field} style={{ maxWidth: 260 }}>
        <label htmlFor={id("rp")}>Repeat weekly</label>
        <select id={id("rp")} name="repeatWeeks" className={a.select} defaultValue="0">
          <option value="0">Just once</option>
          {[1, 3, 7, 11, 25, 51].map((n) => (
            <option key={n} value={n}>
              For {n + 1} weeks
            </option>
          ))}
        </select>
      </div>
      <div className={a.formFoot}>
        <SubmitButton pendingText="Blocking…">Block time</SubmitButton>
      </div>
    </ActionForm>
  );
}
