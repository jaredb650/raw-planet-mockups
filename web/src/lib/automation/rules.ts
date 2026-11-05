/**
 * Pure "is this automation due?" rules. No DB, no clock: every function takes
 * `now`, so the timing is unit-tested (tests/unit/automation-rules.test.ts).
 */
import { TZDate } from "@date-fns/tz";
import { BUSINESS } from "@/lib/config";

const H = 3600_000;
const DAY = 24 * H;

/** Guest emails are never automated for bookings owned by another platform. */
export const PLATFORM_SOURCES = new Set(["airbnb", "viator"]);

export function guestAutomationAllowed(b: { source: string; contactEmail: string }): boolean {
  if (PLATFORM_SOURCES.has(b.source)) return false;
  const e = b.contactEmail.trim().toLowerCase();
  return e.includes("@") && !e.endsWith(".invalid");
}

/** Hour of day (0–23) in New York. */
export function nyHour(now: Date): number {
  return new TZDate(now, BUSINESS.timeZone).getHours();
}

/** Marketing-ish emails (thank-you, review nudge) only go out 9am–8pm New York time. */
export function inSendingHours(now: Date): boolean {
  const h = nyHour(now);
  return h >= 9 && h < 20;
}

export const REMINDER_LEAD_H = 24;

/**
 * Reminder: from 24h before the start until 1h before. Skipped when the
 * booking was confirmed less than 20h before the start: the confirmation
 * email is still fresh in their inbox.
 */
export function reminderDue(
  b: { status: string; startAt: Date; reminderSentAt: Date | null; confirmedAt: Date | null; createdAt: Date },
  now: Date,
): boolean {
  if (b.status !== "confirmed" || b.reminderSentAt) return false;
  const until = b.startAt.getTime() - now.getTime();
  if (until > REMINDER_LEAD_H * H || until < 1 * H) return false;
  const booked = (b.confirmedAt ?? b.createdAt).getTime();
  return b.startAt.getTime() - booked >= 20 * H;
}

/** Thank-you + review ask: 3h after the end, within 7 days, in sending hours, not for no-shows. */
export function followupDue(b: { status: string; endAt: Date; followupSentAt: Date | null }, now: Date): boolean {
  if (b.followupSentAt || !(b.status === "confirmed" || b.status === "completed")) return false;
  const since = now.getTime() - b.endAt.getTime();
  return since >= 3 * H && since <= 7 * DAY && inSendingHours(now);
}

/** One review reminder, 4+ days after the thank-you, within 21 days of the session, if no review yet. */
export function reviewNudgeDue(
  b: { status: string; endAt: Date; followupSentAt: Date | null; reviewRequestSentAt: Date | null },
  now: Date,
  hasReview: boolean,
): boolean {
  if (hasReview || b.reviewRequestSentAt || !b.followupSentAt) return false;
  if (!(b.status === "confirmed" || b.status === "completed")) return false;
  if (now.getTime() - b.followupSentAt.getTime() < 4 * DAY) return false;
  if (now.getTime() - b.endAt.getTime() > 21 * DAY) return false;
  return inSendingHours(now);
}

/**
 * Abandoned checkout: one email 45 min – 24h after the hold expired, only if
 * the session is still 24h+ away and they haven't booked since.
 */
export function abandonedDue(
  b: { status: string; source: string; abandonedEmailSentAt: Date | null; updatedAt: Date; startAt: Date },
  now: Date,
  ctx: { rebooked: boolean; cancelledByGuest: boolean },
): boolean {
  if (b.status !== "expired" || b.source !== "direct" || b.abandonedEmailSentAt) return false;
  if (ctx.rebooked || ctx.cancelledByGuest) return false;
  const since = now.getTime() - b.updatedAt.getTime();
  if (since < 45 * 60_000 || since > DAY) return false;
  return b.startAt.getTime() - now.getTime() >= DAY;
}

/** Scheduled gift card delivery. */
export function giftCardDeliveryDue(
  c: { status: string; recipientEmail: string | null; deliverAt: Date | null; deliveredAt: Date | null },
  now: Date,
): boolean {
  return c.status === "active" && Boolean(c.recipientEmail) && !c.deliveredAt && Boolean(c.deliverAt) && c.deliverAt!.getTime() <= now.getTime();
}

/** Host digest: once per New York day, from 7am. */
export function digestDue(now: Date, lastDigestDate: string | null | undefined, todayKey: string): boolean {
  return nyHour(now) >= 7 && lastDigestDate !== todayKey;
}

/**
 * Weekly report: once per Monday-started week, from 7am New York on Monday.
 * Later days catch up a missed Monday, so a daily cron at any hour still sends it.
 */
export function weeklyReportDue(now: Date, lastWeek: string | null | undefined, thisWeek: string, todayKey: string): boolean {
  return lastWeek !== thisWeek && (todayKey !== thisWeek || nyHour(now) >= 7);
}

/** Stop retrying a failed automated email after this many failures. */
export const MAX_SEND_ATTEMPTS = 3;
