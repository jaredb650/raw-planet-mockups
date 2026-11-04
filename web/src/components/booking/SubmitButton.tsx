"use client";

import { useFormStatus } from "react-dom";

/** Submit button that shows a pending label; the form still works before hydration. */
export function SubmitButton({ children, pendingLabel, className }: { children: React.ReactNode; pendingLabel: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
