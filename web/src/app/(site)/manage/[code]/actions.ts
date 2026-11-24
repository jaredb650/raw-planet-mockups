"use server";

import { redirect } from "next/navigation";
import { BookingError, cancelBooking, getBookingForCustomer, rescheduleBooking } from "@/lib/booking/service";

export type ManageState = { error: string | null };

function back(code: string, token: string, done: string): never {
  redirect(`/manage/${encodeURIComponent(code)}?t=${encodeURIComponent(token)}&done=${done}`);
}

export async function rescheduleAction(_prev: ManageState, form: FormData): Promise<ManageState> {
  const code = String(form.get("code") ?? "");
  const token = String(form.get("t") ?? "");
  const start = String(form.get("start") ?? "");
  const b = await getBookingForCustomer(code, token);
  if (!b) return { error: "This link isn't valid any more. Request a new one from the Manage page." };
  const when = new Date(start);
  if (!start || Number.isNaN(when.getTime())) return { error: "Pick a new time first." };
  if (when.getTime() === b.startAt.getTime()) return { error: "That's your current time. Pick a different one." };
  try {
    await rescheduleBooking(b.id, when.toISOString(), { by: "customer", reason: "Moved by guest online" });
  } catch (err) {
    if (err instanceof BookingError) return { error: err.message };
    console.error("[manage] reschedule failed", err);
    return { error: "Something went wrong on our side. Please try again in a moment." };
  }
  back(b.code, token, "moved");
}

export async function cancelAction(_prev: ManageState, form: FormData): Promise<ManageState> {
  const code = String(form.get("code") ?? "");
  const token = String(form.get("t") ?? "");
  const reason = String(form.get("reason") ?? "").trim().slice(0, 500);
  const b = await getBookingForCustomer(code, token);
  if (!b) return { error: "This link isn't valid any more. Request a new one from the Manage page." };
  try {
    await cancelBooking(b.id, { by: "customer", reason: reason || "Cancelled by guest online", refund: "policy" });
  } catch (err) {
    if (err instanceof BookingError) return { error: err.message };
    console.error("[manage] cancel failed", err);
    return { error: "Something went wrong on our side. Please try again in a moment." };
  }
  back(b.code, token, "cancelled");
}
