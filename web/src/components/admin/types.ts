/** Shape every admin server action returns to its form (serialisable). */
export type ActionResult = {
  ok: boolean;
  message?: string;
  /** Changes on every run so the same message re-announces. */
  at?: number;
  /** Optional data for the client (e.g. a copied URL). */
  data?: Record<string, string | number | boolean | null>;
} | null;

export type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
