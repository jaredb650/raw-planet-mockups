"use client";

import { ActionForm, SubmitButton } from "./ActionForm";
import { Icon } from "./Icon";
import { checkInAction } from "@/app/admin/(panel)/bookings/actions";
import a from "./admin.module.css";

/** One tap to check a guest in, then an undo for a mis-tap. */
export function CheckInButton({ id, guest, checkedIn }: { id: string; guest: string; checkedIn: boolean }) {
  return (
    <ActionForm action={checkInAction} className={a.row}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="undo" value={checkedIn ? "1" : ""} />
      <SubmitButton className={checkedIn ? `${a.btn} ${a.btnSm} ${a.btnGhost}` : `${a.btn} ${a.btnPrimary}`} pendingText="…">
        {!checkedIn && <Icon name="check" size={15} />}
        {checkedIn ? "Undo check-in" : "Check in"}
        <span className="sr-only"> {guest}</span>
      </SubmitButton>
    </ActionForm>
  );
}
