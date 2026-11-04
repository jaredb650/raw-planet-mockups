"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { inquiries } from "@/lib/db/schema";
import {
  addInternalNote,
  cancelBooking,
  createManualBooking,
  logEvent,
  refundBooking,
  rescheduleBooking,
  resendConfirmation,
  setBookingStatus,
  setDeliverable,
  type RefundMode,
} from "@/lib/booking/service";
import { adminAction, bool, cents, int, localDateTime, optStr, str } from "@/lib/admin/action";
import { formatMoney } from "@/lib/money";
import { fmtDateShort, fmtTimeRange } from "@/lib/time";
import type { ActionResult } from "@/components/admin/types";

const id = (fd: FormData) => z.string().min(1, "Missing booking").parse(str(fd, "id"));

export async function setStatusAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const status = z.enum(["completed", "no_show", "confirmed"]).parse(str(fd, "status"));
    await setBookingStatus(id(fd), status);
    return status === "completed" ? "Marked completed." : status === "no_show" ? "Marked as no-show." : "Re-opened.";
  });
}

export async function calendarResolvedAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const db = await getDb();
    await logEvent(db, id(fd), "calendar_resolved", "Calendar problem marked as fixed", { actor: "admin" });
    return "Marked as fixed.";
  });
}

export async function cancelAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const mode = z.enum(["policy", "full", "none", "custom"]).parse(str(fd, "refund"));
    const refund: RefundMode = mode === "custom" ? { cardCents: cents(fd, "customAmount") } : mode;
    const r = await cancelBooking(id(fd), {
      by: "admin",
      reason: optStr(fd, "reason") ?? undefined,
      refund,
      notifyCustomer: bool(fd, "notify"),
    });
    const parts = [
      r.refundedCardCents ? `${formatMoney(r.refundedCardCents)} refunded to card` : "",
      r.refundedGiftCardCents ? `${formatMoney(r.refundedGiftCardCents)} back on gift card` : "",
    ].filter(Boolean);
    return `Booking cancelled${parts.length ? ` — ${parts.join(", ")}` : " — no refund"}.`;
  });
}

export async function refundAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const amount = cents(fd, "amount");
    if (amount <= 0) throw new Error("Enter an amount above $0.");
    const reason = str(fd, "reason");
    const b = await refundBooking(id(fd), amount, reason);
    return `Refunded. ${formatMoney(b.amountRefundedCents)} refunded in total.`;
  });
}

export async function rescheduleAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const force = bool(fd, "force");
    const duration = int(fd, "duration");
    let start: Date;
    if (force) start = localDateTime(fd, "date", "time");
    else {
      const iso = str(fd, "slot");
      if (!iso) throw new Error("Pick a new time, or tick “override” to type one in.");
      start = new Date(iso);
      if (Number.isNaN(start.getTime())) throw new Error("Pick a new time.");
    }
    const b = await rescheduleBooking(id(fd), start.toISOString(), {
      by: "admin",
      durationMinutes: duration,
      force,
      reason: optStr(fd, "reason") ?? undefined,
      notifyCustomer: bool(fd, "notify"),
    });
    return `Moved to ${fmtDateShort(b.startAt)}, ${fmtTimeRange(b.startAt, b.endAt)}.`;
  });
}

export async function deliverableAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const status = z.enum(["none", "in_progress", "delivered"]).parse(str(fd, "status"));
    const url = optStr(fd, "url");
    if (url) z.string().url("Paste a full link starting with https://").parse(url);
    if (status === "delivered" && !url) throw new Error("Paste the download link before marking it delivered.");
    const notify = bool(fd, "notify");
    await setDeliverable(id(fd), { status, url, notifyCustomer: notify });
    if (status === "delivered") return notify ? "Delivered — the guest has been emailed the link." : "Marked delivered (no email sent).";
    return status === "in_progress" ? "Marked in progress." : "Reset.";
  });
}

export async function noteAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const note = str(fd, "note");
    if (!note) throw new Error("Write a note first.");
    await addInternalNote(id(fd), note);
    return "Note added.";
  });
}

export async function resendConfirmationAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const r = await resendConfirmation(id(fd));
    if (!r.sent) throw new Error(`The confirmation to ${r.to} didn't go out — check Emails for the error.`);
    return `Confirmation sent to ${r.to}.`;
  });
}

const manualSchema = z.object({
  experienceId: z.string().min(1, "Choose an experience"),
  durationMinutes: z.number().int().min(15).max(24 * 60),
  guests: z.number().int().min(1, "At least 1 guest").max(200),
  name: z.string().min(1, "Guest name is required"),
  email: z.union([z.literal(""), z.string().email("That email doesn't look right")]),
  phone: z.string().max(40),
  source: z.enum(["phone", "manual", "airbnb", "viator", "direct", "cal"]),
});

export async function createManualAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const v = manualSchema.parse({
      experienceId: str(fd, "experienceId"),
      durationMinutes: int(fd, "durationMinutes"),
      guests: int(fd, "guests"),
      name: str(fd, "name"),
      email: str(fd, "email"),
      phone: str(fd, "phone"),
      source: str(fd, "source"),
    });
    const start = localDateTime(fd, "date", "time");
    const b = await createManualBooking({
      experienceId: v.experienceId,
      start: start.toISOString(),
      durationMinutes: v.durationMinutes,
      guests: v.guests,
      contact: { name: v.name, email: v.email, phone: v.phone || null },
      source: v.source,
      amountPaidCents: cents(fd, "amountPaid", 0),
      externalRef: optStr(fd, "externalRef"),
      notes: str(fd, "notes"),
      allowConflicts: bool(fd, "allowConflicts"),
      sendConfirmation: bool(fd, "sendConfirmation") && Boolean(v.email),
      language: str(fd, "language") === "es" ? "es" : "en",
      occasion: optStr(fd, "occasion"),
    });
    const db = await getDb();
    const inquiryId = optStr(fd, "inquiryId");
    if (inquiryId) {
      await db.update(inquiries).set({ status: "converted" }).where(eq(inquiries.id, inquiryId));
      await logEvent(db, b.id, "note", "Converted from an inquiry", { actor: "admin", data: { inquiryId } });
    }
    revalidatePath("/admin", "layout");
    redirect(`/admin/bookings/${b.id}?created=1`);
  });
}
