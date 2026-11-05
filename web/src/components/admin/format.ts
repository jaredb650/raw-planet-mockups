/** Labels and tones shared by admin screens (pure; safe on server and client). */
import type { BookingSource, BookingStatus, DeliverableStatus, GiftCardStatus, PaymentStatus } from "@/lib/db/schema";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

export const BOOKING_STATUS: Record<BookingStatus, { label: string; tone: Tone }> = {
  confirmed: { label: "Confirmed", tone: "success" },
  pending_payment: { label: "Checkout hold", tone: "warning" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
  expired: { label: "Expired", tone: "neutral" },
  no_show: { label: "No-show", tone: "danger" },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  unpaid: { label: "Unpaid", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  partially_refunded: { label: "Part refunded", tone: "warning" },
  refunded: { label: "Refunded", tone: "neutral" },
  not_required: { label: "No payment", tone: "neutral" },
};

export const SOURCE_LABEL: Record<BookingSource, string> = {
  direct: "Website",
  airbnb: "Airbnb",
  viator: "Viator",
  manual: "Manual",
  cal: "Cal.com",
  phone: "Phone",
};

export const DELIVERABLE: Record<DeliverableStatus, { label: string; tone: Tone }> = {
  none: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "warning" },
  delivered: { label: "Delivered", tone: "success" },
};

export const GIFT_STATUS: Record<GiftCardStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  depleted: { label: "Used up", tone: "neutral" },
  void: { label: "Void", tone: "danger" },
  pending_payment: { label: "Not paid", tone: "warning" },
};

export const THEMES = ["production", "dj", "wellness"] as const;
export function themeKey(theme: string | null | undefined): (typeof THEMES)[number] {
  return (THEMES as readonly string[]).includes(theme ?? "") ? (theme as (typeof THEMES)[number]) : "production";
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** tel:/sms: friendly number (keeps + and digits). */
export function telHref(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

/** 14 → "2pm" */
export function fmtHour(h: number) {
  return `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
}
