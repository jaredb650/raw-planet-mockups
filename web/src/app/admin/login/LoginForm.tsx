"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import a from "@/components/admin/admin.module.css";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, null);
  return (
    <form action={action} className={a.form}>
      <input type="hidden" name="next" value={next} />
      <div className={a.field}>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          className={a.input}
          autoComplete="current-password"
          required
          autoFocus
          aria-invalid={state?.error ? true : undefined}
          aria-describedby={state?.error ? "login-error" : undefined}
        />
      </div>
      <p id="login-error" role="alert" className={`${a.msg} ${a.msgErr}`} hidden={!state?.error}>
        {state?.error}
      </p>
      <button type="submit" className={`${a.btn} ${a.btnPrimary} ${a.btnBlock}`} disabled={pending} style={{ minHeight: 46 }}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
