"use client";

/**
 * Form wrapper for admin server actions: shows pending state and the action's
 * result inline (aria-live), keeps the user's input when the action fails,
 * and optionally resets or runs a callback on success.
 */
import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { ActionResult, FormAction } from "./types";
import a from "./admin.module.css";

const PendingCtx = createContext(false);
export const useFormPending = () => useContext(PendingCtx);
const StateCtx = createContext<ActionResult>(null);

/** Renders the enclosing ActionForm's result here (use with hideMessage). */
export function InlineMessage() {
  return <FormMessage state={useContext(StateCtx)} />;
}

export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  hideMessage = false,
  onResult,
  id,
  "aria-label": ariaLabel,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  hideMessage?: boolean;
  onResult?: (r: ActionResult) => void;
  id?: string;
  "aria-label"?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  });
  useEffect(() => {
    if (!state) return;
    if (state.ok && resetOnSuccess) ref.current?.reset();
    onResultRef.current?.(state);
  }, [state, resetOnSuccess]);

  return (
    <PendingCtx.Provider value={pending}>
      <StateCtx.Provider value={state}>
      <form
        ref={ref}
        id={id}
        aria-label={ariaLabel}
        className={className ?? a.form}
        action={formAction}
        aria-busy={pending}
        onSubmit={(e) => {
          // Submit through a transition so React doesn't auto-reset the form
          // (keeps what was typed if the server says no).
          e.preventDefault();
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
          const fd = new FormData(e.currentTarget, submitter && "form" in submitter ? submitter : undefined);
          startTransition(() => formAction(fd));
        }}
      >
        {children}
        {!hideMessage && <FormMessage state={state} />}
      </form>
      </StateCtx.Provider>
    </PendingCtx.Provider>
  );
}

export function FormMessage({ state }: { state: ActionResult }) {
  return (
    <p role="status" aria-live="polite" className={`${a.msg} ${state?.ok ? a.msgOk : a.msgErr}`} key={state?.at} hidden={!state?.message}>
      {state?.message}
    </p>
  );
}

export function SubmitButton({
  children,
  className,
  pendingText,
  name,
  value,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  pendingText?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const pending = useFormPending();
  return (
    <button type="submit" className={className ?? `${a.btn} ${a.btnPrimary}`} disabled={pending || disabled} name={name} value={value}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/**
 * Two-step submit for destructive actions: the first press arms it, the
 * second (clearly labelled) press submits. "Keep" disarms.
 */
export function ConfirmSubmit({
  children,
  confirmLabel,
  className,
  name,
  value,
  question,
}: {
  children: ReactNode;
  confirmLabel: string;
  className?: string;
  name?: string;
  value?: string;
  question?: string;
}) {
  const [armed, setArmed] = useState(false);
  const pending = useFormPending();
  if (!armed)
    return (
      <button type="button" className={className ?? `${a.btn} ${a.btnDanger}`} onClick={() => setArmed(true)}>
        {children}
      </button>
    );
  return (
    <span className={a.row} role="group" aria-label="Confirm">
      {question && <span className={a.small}>{question}</span>}
      <button type="submit" className={`${a.btn} ${a.btnDangerSolid}`} disabled={pending} name={name} value={value} autoFocus>
        {pending ? "Working…" : confirmLabel}
      </button>
      <button type="button" className={`${a.btn} ${a.btnGhost}`} onClick={() => setArmed(false)} disabled={pending}>
        Keep
      </button>
    </span>
  );
}
