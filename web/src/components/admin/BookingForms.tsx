"use client";

import { useState } from "react";
import { ActionForm, ConfirmSubmit, SubmitButton } from "./ActionForm";
import { SlotPicker } from "./SlotPicker";
import type { FormAction } from "./types";
import a from "./admin.module.css";

const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
const durLabel = (m: number) => (m % 60 === 0 ? `${m / 60} hour${m === 60 ? "" : "s"}` : `${(m / 60).toFixed(1)} hours`);

export function RescheduleForm({
  action,
  bookingId,
  experienceId,
  currentDate,
  currentDuration,
  durations,
  hasEmail,
}: {
  action: FormAction;
  bookingId: string;
  experienceId: string;
  currentDate: string;
  currentDuration: number;
  durations: number[];
  hasEmail: boolean;
}) {
  const [date, setDate] = useState(currentDate);
  const [duration, setDuration] = useState(currentDuration);
  const [slot, setSlot] = useState<string | null>(null);
  const [force, setForce] = useState(false);
  const opts = durations.includes(currentDuration) ? durations : [currentDuration, ...durations];
  return (
    <ActionForm action={action} onResult={(r) => r?.ok && setSlot(null)}>
      <input type="hidden" name="id" value={bookingId} />
      <div className={a.formRow}>
        <div className={a.field}>
          <label htmlFor="rs-date">New date</label>
          <input id="rs-date" name="date" type="date" className={a.input} value={date} onChange={(e) => (setDate(e.target.value), setSlot(null))} required />
        </div>
        <div className={a.field}>
          <label htmlFor="rs-dur">Length</label>
          <select id="rs-dur" name="duration" className={a.select} value={duration} onChange={(e) => (setDuration(Number(e.target.value)), setSlot(null))}>
            {opts.map((m) => (
              <option key={m} value={m}>
                {durLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!force ? (
        <div className={a.field}>
          <span className={a.label}>Start time</span>
          <SlotPicker experienceId={experienceId} date={date} duration={duration} ignoreBookingId={bookingId} value={slot} onPick={setSlot} />
          <input type="hidden" name="slot" value={slot ?? ""} />
        </div>
      ) : (
        <div className={a.field}>
          <label htmlFor="rs-time">Start time (New York)</label>
          <input id="rs-time" name="time" type="time" step={900} className={a.input} required />
          <p className={a.hint}>Skips the availability check. Make sure nothing else is booked then.</p>
        </div>
      )}
      <label className={a.check}>
        <input type="checkbox" name="force" checked={force} onChange={(e) => setForce(e.target.checked)} />
        <span>Type a time instead (outside opening hours or over a block)</span>
      </label>
      <div className={a.field}>
        <label htmlFor="rs-reason">Reason (optional, kept in the timeline)</label>
        <input id="rs-reason" name="reason" className={a.input} placeholder="e.g. Guest asked by text" />
      </div>
      <label className={a.check}>
        <input type="checkbox" name="notify" defaultChecked={hasEmail} disabled={!hasEmail} />
        <span>Email the guest the new time{!hasEmail && " (no email on file)"}</span>
      </label>
      <div className={a.formFoot}>
        <SubmitButton pendingText="Moving…" disabled={!force && !slot}>
          Move booking
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function CancelForm({
  action,
  bookingId,
  policyCents,
  policyGiftCents,
  policyEligible,
  remainingCents,
  giftCardCents,
  cancellationHours,
  hasEmail,
}: {
  action: FormAction;
  bookingId: string;
  policyCents: number;
  policyGiftCents: number;
  policyEligible: boolean;
  remainingCents: number;
  giftCardCents: number;
  cancellationHours: number;
  hasEmail: boolean;
}) {
  const [mode, setMode] = useState(remainingCents > 0 || giftCardCents > 0 ? "policy" : "none");
  const paid = remainingCents > 0 || giftCardCents > 0;
  return (
    <ActionForm action={action}>
      <input type="hidden" name="id" value={bookingId} />
      {paid ? (
        <fieldset className={a.fieldset}>
          <legend>Refund</legend>
          <label className={a.check}>
            <input type="radio" name="refund" value="policy" checked={mode === "policy"} onChange={() => setMode("policy")} />
            <span>
              Follow the policy: <strong>{money(policyCents)}</strong>
              {policyGiftCents ? ` + ${money(policyGiftCents)} back on gift card` : ""}
              <span className={a.cellSub}>
                {policyEligible ? `More than ${cancellationHours}h before the session, so a full refund.` : `Inside ${cancellationHours}h of the session, so no refund under the policy.`}
              </span>
            </span>
          </label>
          <label className={a.check}>
            <input type="radio" name="refund" value="full" checked={mode === "full"} onChange={() => setMode("full")} />
            <span>
              Full refund: <strong>{money(remainingCents)}</strong>
              {giftCardCents ? ` + ${money(giftCardCents)} back on gift card` : ""}
            </span>
          </label>
          <label className={a.check}>
            <input type="radio" name="refund" value="custom" checked={mode === "custom"} onChange={() => setMode("custom")} />
            <span>Part refund to card</span>
          </label>
          {mode === "custom" && (
            <div className={a.field} style={{ maxWidth: 200, marginLeft: 27 }}>
              <label htmlFor="cx-amt">Amount</label>
              <input id="cx-amt" name="customAmount" inputMode="decimal" className={a.input} placeholder={`max ${money(remainingCents)}`} required />
            </div>
          )}
          <label className={a.check}>
            <input type="radio" name="refund" value="none" checked={mode === "none"} onChange={() => setMode("none")} />
            <span>No refund</span>
          </label>
        </fieldset>
      ) : (
        <input type="hidden" name="refund" value="none" />
      )}
      <div className={a.field}>
        <label htmlFor="cx-reason">Reason (optional)</label>
        <input id="cx-reason" name="reason" className={a.input} placeholder="e.g. Guest is sick" />
      </div>
      <label className={a.check}>
        <input type="checkbox" name="notify" defaultChecked={hasEmail} disabled={!hasEmail} />
        <span>Email the guest a cancellation notice{!hasEmail && " (no email on file)"}</span>
      </label>
      <div className={a.formFoot}>
        <ConfirmSubmit confirmLabel="Yes, cancel booking" question="This frees the slot.">
          Cancel booking…
        </ConfirmSubmit>
      </div>
    </ActionForm>
  );
}
