"use client";

import { ActionForm, SubmitButton } from "./ActionForm";
import { setStatusAction } from "@/app/admin/(panel)/bookings/actions";
import a from "./admin.module.css";

/** "Completed" / "No-show" buttons for a session that has ended. */
export function QuickStatus({ id }: { id: string }) {
  return (
    <ActionForm action={setStatusAction} className={a.row}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton name="status" value="completed" className={`${a.btn} ${a.btnSm} ${a.btnPrimary}`}>
        Mark completed
      </SubmitButton>
      <SubmitButton name="status" value="no_show" className={`${a.btn} ${a.btnSm}`}>
        No-show
      </SubmitButton>
    </ActionForm>
  );
}
