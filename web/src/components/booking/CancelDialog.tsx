"use client";

import { useActionState, useId, useRef } from "react";
import styles from "./pages.module.css";

type State = { error: string | null };

export function CancelDialog({
  action,
  code,
  token,
  refundText,
}: {
  action: (prev: State, form: FormData) => Promise<State>;
  code: string;
  token: string;
  refundText: string;
}) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(action, { error: null });
  return (
    <>
      <button type="button" className="btn btn--ghost" onClick={() => ref.current?.showModal()}>
        Cancel booking
      </button>
      <dialog ref={ref} className={styles.dialog} aria-labelledby={`${id}-t`}>
        <form action={formAction} className={styles.dialogBody}>
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="t" value={token} />
          <h2 id={`${id}-t`}>Cancel this session?</h2>
          <p>{refundText}</p>
          <div className="field">
            <label htmlFor={`${id}-r`}>
              Mind telling us why? <span className={styles.optional}>(optional)</span>
            </label>
            <textarea id={`${id}-r`} name="reason" className="textarea" maxLength={500} style={{ minHeight: 80 }} />
          </div>
          {state.error ? (
            <p className="notice notice--danger" role="alert">
              {state.error}
            </p>
          ) : null}
          <div className={styles.row}>
            <button type="submit" className="btn btn--danger" disabled={pending}>
              {pending ? "Cancelling…" : "Yes, cancel it"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => ref.current?.close()} disabled={pending}>
              Keep my booking
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
