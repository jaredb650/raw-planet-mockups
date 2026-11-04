"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "./ActionForm";
import { SlotPicker, nyHHMM } from "./SlotPicker";
import type { FormAction } from "./types";
import a from "./admin.module.css";

export type NewBookingExperience = {
  id: string;
  name: string;
  durations: number[];
  minGuests: number;
  maxGuests: number;
  active: boolean;
};

export type NewBookingPrefill = {
  experienceId?: string;
  date?: string;
  time?: string;
  guests?: number;
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  inquiryId?: string;
  source?: string;
};

const SOURCES: { value: string; label: string; hint: string }[] = [
  { value: "phone", label: "Phone / text / DM", hint: "A guest who booked with you directly." },
  { value: "airbnb", label: "Airbnb", hint: "Mirror an Airbnb booking so it shows in your reports. Airbnb already blocks the time in Google Calendar, so it isn’t sent to Cal.com." },
  { value: "viator", label: "Viator", hint: "Viator has no calendar sync, so adding it here is what stops the website selling the same time." },
  { value: "manual", label: "Other / comp", hint: "Friends, comps, collaborations." },
];

const durLabel = (m: number) => (m % 60 === 0 ? `${m / 60} hour${m === 60 ? "" : "s"}` : `${(m / 60).toFixed(1)} hours`);

export function NewBookingForm({
  action,
  experiences,
  prefill,
  today,
}: {
  action: FormAction;
  experiences: NewBookingExperience[];
  prefill: NewBookingPrefill;
  today: string;
}) {
  const first = experiences.find((e) => e.id === prefill.experienceId) ?? experiences.find((e) => e.active) ?? experiences[0];
  const [expId, setExpId] = useState(first?.id ?? "");
  const exp = experiences.find((e) => e.id === expId) ?? first;
  const [duration, setDuration] = useState(exp?.durations[0] ?? 120);
  const [date, setDate] = useState(prefill.date ?? today);
  const [time, setTime] = useState(prefill.time ?? "");
  const [slot, setSlot] = useState<string | null>(null);
  const [source, setSource] = useState(prefill.source ?? "phone");
  const [email, setEmail] = useState(prefill.email ?? "");
  const src = SOURCES.find((s) => s.value === source) ?? SOURCES[0];
  const platform = source === "airbnb" || source === "viator";

  return (
    <ActionForm action={action}>
      {prefill.inquiryId && <input type="hidden" name="inquiryId" value={prefill.inquiryId} />}

      <fieldset className={a.fieldset}>
        <legend>Where it came from</legend>
        <div className={a.formRow}>
          <div className={a.field}>
            <label htmlFor="nb-source">Source</label>
            <select id="nb-source" name="source" className={a.select} value={source} onChange={(e) => setSource(e.target.value)}>
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {platform && (
            <div className={a.field}>
              <label htmlFor="nb-ref">{source === "airbnb" ? "Airbnb confirmation code" : "Viator booking reference"}</label>
              <input id="nb-ref" name="externalRef" className={a.input} placeholder={source === "airbnb" ? "HMABCD1234" : "BR-123456789"} autoComplete="off" />
            </div>
          )}
        </div>
        <p className={a.hint}>{src.hint}</p>
      </fieldset>

      <fieldset className={a.fieldset}>
        <legend>Session</legend>
        <div className={a.formRow} style={{ ["--cols" as string]: 3 }}>
          <div className={a.field}>
            <label htmlFor="nb-exp">Experience</label>
            <select
              id="nb-exp"
              name="experienceId"
              className={a.select}
              value={expId}
              onChange={(e) => {
                const next = experiences.find((x) => x.id === e.target.value);
                setExpId(e.target.value);
                if (next && !next.durations.includes(duration)) setDuration(next.durations[0] ?? 120);
                setSlot(null);
              }}
              required
            >
              {experiences.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.active ? "" : " (hidden)"}
                </option>
              ))}
            </select>
          </div>
          <div className={a.field}>
            <label htmlFor="nb-dur">Length</label>
            <select id="nb-dur" name="durationMinutes" className={a.select} value={duration} onChange={(e) => (setDuration(Number(e.target.value)), setSlot(null))}>
              {(exp?.durations ?? [120]).map((m) => (
                <option key={m} value={m}>
                  {durLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <div className={a.field}>
            <label htmlFor="nb-guests">Guests</label>
            <input id="nb-guests" name="guests" type="number" inputMode="numeric" min={1} max={200} className={a.input} defaultValue={prefill.guests ?? exp?.minGuests ?? 1} required />
            {exp && <span className={a.hint}>Usually {exp.minGuests}–{exp.maxGuests}</span>}
          </div>
        </div>
        <div className={a.formRow}>
          <div className={a.field}>
            <label htmlFor="nb-date">Date</label>
            <input id="nb-date" name="date" type="date" className={a.input} value={date} onChange={(e) => (setDate(e.target.value), setSlot(null))} required />
          </div>
          <div className={a.field}>
            <label htmlFor="nb-time">Start time (New York)</label>
            <input
              id="nb-time"
              name="time"
              type="time"
              step={900}
              className={a.input}
              value={time}
              onChange={(e) => (setTime(e.target.value), setSlot(null))}
              required
            />
          </div>
        </div>
        <div className={a.field}>
          <span className={a.label}>Open times that day</span>
          <SlotPicker
            experienceId={expId}
            date={date}
            duration={duration}
            value={slot}
            name="nbSlot"
            onPick={(iso) => {
              setSlot(iso);
              if (iso) setTime(nyHHMM(iso));
            }}
          />
        </div>
        <label className={a.check}>
          <input type="checkbox" name="allowConflicts" />
          <span>
            Book it even if it overlaps something
            <span className={a.cellSub}>Use when the guest is already confirmed elsewhere and you’ll sort out the clash.</span>
          </span>
        </label>
      </fieldset>

      <fieldset className={a.fieldset}>
        <legend>Guest</legend>
        <div className={a.field}>
          <label htmlFor="nb-name">Name</label>
          <input id="nb-name" name="name" className={a.input} defaultValue={prefill.name} autoComplete="off" required />
        </div>
        <div className={a.formRow}>
          <div className={a.field}>
            <label htmlFor="nb-email">Email</label>
            <input id="nb-email" name="email" type="email" className={a.input} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" placeholder="Optional" />
          </div>
          <div className={a.field}>
            <label htmlFor="nb-phone">Phone</label>
            <input id="nb-phone" name="phone" type="tel" className={a.input} defaultValue={prefill.phone} autoComplete="off" placeholder="Optional" />
          </div>
        </div>
        <div className={a.formRow}>
          <div className={a.field}>
            <label htmlFor="nb-occ">Occasion</label>
            <input id="nb-occ" name="occasion" className={a.input} list="nb-occasions" placeholder="Birthday, date night…" />
            <datalist id="nb-occasions">
              <option value="Birthday" />
              <option value="Date night" />
              <option value="Bachelorette" />
              <option value="Team event" />
              <option value="Anniversary" />
            </datalist>
          </div>
          <div className={a.field}>
            <label htmlFor="nb-lang">Emails in</label>
            <select id="nb-lang" name="language" className={a.select} defaultValue="en">
              <option value="en">English</option>
              <option value="es">Spanish</option>
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className={a.fieldset}>
        <legend>Money & notes</legend>
        <div className={a.formRow}>
          <div className={a.field}>
            <label htmlFor="nb-paid">{platform ? "Your payout" : "Amount paid"}</label>
            <input id="nb-paid" name="amountPaid" inputMode="decimal" className={a.input} placeholder="$0" />
            <span className={a.hint}>{platform ? "Counts toward revenue. Leave blank if you don’t know yet." : "Cash, Venmo, Zelle… Leave blank for free."}</span>
          </div>
        </div>
        <div className={a.field}>
          <label htmlFor="nb-notes">Private note</label>
          <textarea id="nb-notes" name="notes" className={a.textarea} rows={3} defaultValue={prefill.notes} />
        </div>
        <label className={a.check}>
          <input type="checkbox" name="sendConfirmation" defaultChecked={!platform && Boolean(email)} disabled={!email} key={`${platform}-${Boolean(email)}`} />
          <span>
            Email the guest a confirmation
            <span className={a.cellSub}>{!email ? "Add an email to send one." : platform ? `${source === "airbnb" ? "Airbnb" : "Viator"} already emails them; leave off to avoid a double.` : "Includes the calendar invite and their manage link."}</span>
          </span>
        </label>
      </fieldset>

      <div className={a.formFoot}>
        <SubmitButton pendingText="Saving…">Add booking</SubmitButton>
      </div>
    </ActionForm>
  );
}
