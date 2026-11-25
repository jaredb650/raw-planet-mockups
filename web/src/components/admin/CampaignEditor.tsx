"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { CampaignSegment } from "@/lib/db/schema";
import { ActionForm, ConfirmSubmit, SubmitButton } from "./ActionForm";
import { Panel } from "./PageHeader";
import { plural } from "./format";
import type { FormAction } from "./types";
import a from "./admin.module.css";

/** Draft workspace: editing, live audience count, auto-saving before Test/Send, and deleting drafts. */
export function CampaignEditor({
  action,
  testAction,
  sendAction,
  deleteAction,
  campaign: c,
  tags,
  experiences,
  initialCount,
  defaultTestTo,
  hasPostalAddress,
  postalAddressMissing,
  testMode,
  preview,
}: {
  action: FormAction;
  testAction: FormAction;
  sendAction: FormAction;
  deleteAction: FormAction;
  campaign: { id: string; name: string; subject: string; body: string; segment: CampaignSegment };
  tags: string[];
  experiences: { id: string; name: string }[];
  initialCount: number;
  defaultTestTo: string;
  hasPostalAddress: boolean;
  postalAddressMissing: string;
  testMode: boolean;
  preview: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<{ base: number; count: number; problem: boolean } | null>(null);
  const [counting, setCounting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inFlight = useRef<AbortController>(undefined);

  const count = live && live.base === initialCount ? live.count : initialCount;
  const problem = live && live.base === initialCount ? live.problem : false;

  useEffect(() => {
    return () => {
      clearTimeout(timer.current);
      inFlight.current?.abort();
    };
  }, []);

  function editorForm(): HTMLFormElement | null {
    return box.current?.closest("form") ?? null;
  }

  function refresh() {
    clearTimeout(timer.current);
    setCounting(true);
    const base = initialCount;
    timer.current = setTimeout(async () => {
      const form = editorForm();
      if (!form) {
        setCounting(false);
        return;
      }
      inFlight.current?.abort();
      const ctl = (inFlight.current = new AbortController());
      try {
        const res = await fetch("/api/admin/campaigns/count", { method: "POST", body: new FormData(form), signal: ctl.signal });
        if (!res.ok) throw new Error();
        setLive({ base, count: (await res.json()).count, problem: false });
      } catch {
        if (!ctl.signal.aborted) setLive({ base, count: base, problem: true });
      } finally {
        if (!ctl.signal.aborted) setCounting(false);
      }
    }, 250);
  }

  /** Merge current unsaved draft editor inputs into a secondary FormData (Test / Send) so edits are auto-saved. */
  const withDraft =
    (fn: FormAction): FormAction =>
    (prev, fd) => {
      const form = document.getElementById("campaign-draft-form") as HTMLFormElement | null;
      if (form) {
        const draft = new FormData(form);
        for (const [k, v] of draft.entries()) {
          if (k === "id") continue;
          fd.append(k, v);
        }
      }
      return fn(prev, fd);
    };

  return (
    <div className={a.split}>
      <div className={a.stack}>
        <Panel title="Write it">
          <div className={a.panelBody}>
            <ActionForm id="campaign-draft-form" action={action}>
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

              <div ref={box} role="group" aria-labelledby="cp-who-heading" className={a.fieldsetBox} onInput={refresh} onChange={refresh}>
                <div>
                  <div id="cp-who-heading" className={a.fieldsetTitle}>
                    Who gets it
                  </div>
                  <p className={a.hint}>Leave every filter below blank to reach everyone who opted in to news.</p>
                </div>
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
                {experiences.length > 0 && (
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
                )}
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
                  {problem ? "Couldn’t count. Check the numbers above." : counting ? "Counting…" : `${count} ${count === 1 ? "person" : "people"} would get this`}
                </p>
                <p className={a.hint}>
                  Only guests who said yes to news (never anyone who unsubscribed, or who only booked through Airbnb or Viator).{" "}
                  {count === 0 && <Link href="/admin/customers">Manage guest opt-ins in Customers →</Link>}
                </p>
              </div>

              <div className={a.formFoot}>
                <SubmitButton pendingText="Saving…">Save</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </Panel>
        {preview}
      </div>

      <div className={a.stack}>
        <Panel title="Send a test">
          <div className={a.panelBody}>
            <ActionForm action={withDraft(testAction)}>
              <input type="hidden" name="id" value={c.id} />
              <div className={a.field}>
                <label htmlFor="cp-test-to">Send test to</label>
                <input id="cp-test-to" name="to" type="email" className={a.input} defaultValue={defaultTestTo} placeholder={defaultTestTo} required />
              </div>
              <p className={a.hint}>Automatically saves your latest edits before sending the test.</p>
              <div className={a.formFoot}>
                <SubmitButton className={a.btn} pendingText="Sending…">
                  Send me a test
                </SubmitButton>
              </div>
            </ActionForm>
          </div>
        </Panel>

        <Panel title="Send it">
          <div className={a.panelBody}>
            {!hasPostalAddress ? (
              <p className={`${a.notice} ${a.noticeWarn}`}>
                {postalAddressMissing} <Link href="/admin/settings">Open Settings</Link>
              </p>
            ) : count === 0 ? (
              <p className={a.hint}>Nobody matches this audience yet.</p>
            ) : (
              <ActionForm action={withDraft(sendAction)}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="expected" value={count} />
                <p className={a.hint}>Saves your latest edits and sends right away{testMode ? ". In test mode it’s only logged" : ""}. This can’t be undone.</p>
                <div className={a.formFoot}>
                  <ConfirmSubmit
                    className={`${a.btn} ${a.btnPrimary}`}
                    confirmLabel={`Yes, send to ${plural(count, "person", "people")}`}
                    question={`Send this to exactly ${plural(count, "person", "people")}?`}
                  >
                    Send campaign
                  </ConfirmSubmit>
                </div>
              </ActionForm>
            )}
          </div>
        </Panel>

        <Panel title="Draft">
          <div className={a.panelBody}>
            <ActionForm action={deleteAction}>
              <input type="hidden" name="id" value={c.id} />
              <p className={a.hint}>Not going to send this one? You can remove the draft cleanly.</p>
              <div className={a.formFoot}>
                <ConfirmSubmit className={`${a.btn} ${a.btnSm} ${a.btnGhost}`} confirmLabel="Delete draft" question="Delete this draft permanently?">
                  Delete draft
                </ConfirmSubmit>
              </div>
            </ActionForm>
          </div>
        </Panel>
      </div>
    </div>
  );
}
