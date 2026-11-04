/**
 * Scheduled jobs, run by /api/cron/run every 10 minutes.
 *
 * Every email job is "claim first": it stamps the booking's *SentAt column
 * with a conditional UPDATE before sending, so two overlapping runs can never
 * both send. If the send FAILS the claim is released for a retry on the next
 * run, up to MAX_SEND_ATTEMPTS failures (counted in email_log). A settings
 * lease (`cronLock`) also stops whole runs from overlapping.
 */
import "server-only";
import { and, eq, gt, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bookingEvents, bookings, emailLog, giftCards, reviews } from "@/lib/db/schema";
import { expireStaleHolds, logEvent } from "@/lib/booking/service";
import { localDateKey } from "@/lib/time";
import { syncCalendarFeeds } from "@/lib/feeds";
import {
  tryAbandonedCheckout,
  tryBookingReminder,
  tryFollowup,
  tryGiftCardEmails,
  tryHostDigest,
  tryReviewNudge,
  type SendStatus,
} from "@/lib/email/notify";
import { acquireLease, getSetting, releaseLease, setSetting } from "./settings";
import {
  abandonedDue,
  digestDue,
  followupDue,
  giftCardDeliveryDue,
  guestAutomationAllowed,
  MAX_SEND_ATTEMPTS,
  reminderDue,
  reviewNudgeDue,
} from "./rules";

const H = 3600_000;
const DAY = 24 * H;

export type JobResult = {
  job: JobName;
  ok: boolean;
  ms: number;
  sent: number;
  skipped: number;
  failed: number;
  /** Job-specific extra info (e.g. feed results, holds expired). */
  detail?: unknown;
  error?: string;
};

export const JOBS = ["expireHolds", "syncFeeds", "giftCardDelivery", "reminders", "abandonedCheckouts", "followups", "reviewNudges", "hostDigest"] as const;
export type JobName = (typeof JOBS)[number];

type Tally = { sent: number; skipped: number; failed: number; detail?: unknown };
const tally = (): Tally => ({ sent: 0, skipped: 0, failed: 0 });
const count = (t: Tally, s: SendStatus) => {
  t[s === "sent" ? "sent" : s === "failed" ? "failed" : "skipped"]++;
};

async function failures(template: string, bookingId: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(emailLog)
    .where(and(eq(emailLog.template, template), eq(emailLog.bookingId, bookingId), eq(emailLog.status, "failed")));
  return Number(row?.n ?? 0);
}

type ClaimCol = "reminderSentAt" | "followupSentAt" | "reviewRequestSentAt" | "abandonedEmailSentAt";

/** Claim → send → release on failure (bounded) → timeline entry on success. */
async function claimAndSend(opts: {
  bookingId: string;
  col: ClaimCol;
  template: string;
  now: Date;
  send: () => Promise<SendStatus>;
  timeline: string;
}): Promise<SendStatus | "taken"> {
  const db = await getDb();
  const column = bookings[opts.col];
  const [claimed] = await db
    .update(bookings)
    .set({ [opts.col]: opts.now })
    .where(and(eq(bookings.id, opts.bookingId), isNull(column)))
    .returning({ id: bookings.id });
  if (!claimed) return "taken";
  const status = await opts.send();
  if (status === "failed") {
    if ((await failures(opts.template, opts.bookingId)) < MAX_SEND_ATTEMPTS) {
      await db.update(bookings).set({ [opts.col]: null }).where(eq(bookings.id, opts.bookingId));
    }
  } else if (status === "sent") {
    await logEvent(db, opts.bookingId, "email_sent", opts.timeline, { public: true });
  }
  return status;
}

/* ------------------------------------------------------------------ */

async function reminders(now: Date): Promise<Tally> {
  const db = await getDb();
  const t = tally();
  const rows = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.status, "confirmed"), isNull(bookings.reminderSentAt), gt(bookings.startAt, new Date(now.getTime() + H)), lte(bookings.startAt, new Date(now.getTime() + 24 * H))));
  for (const b of rows) {
    if (!guestAutomationAllowed(b) || !reminderDue(b, now)) continue;
    const s = await claimAndSend({ bookingId: b.id, col: "reminderSentAt", template: "booking_reminder", now, send: () => tryBookingReminder(b.id, now), timeline: "Reminder email sent" });
    if (s !== "taken") count(t, s);
  }
  return t;
}

async function followups(now: Date): Promise<Tally> {
  const db = await getDb();
  const t = tally();
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        inArray(bookings.status, ["confirmed", "completed"]),
        isNull(bookings.followupSentAt),
        lte(bookings.endAt, new Date(now.getTime() - 3 * H)),
        gte(bookings.endAt, new Date(now.getTime() - 7 * DAY)),
      ),
    );
  for (const b of rows) {
    if (!guestAutomationAllowed(b) || !followupDue(b, now)) continue;
    const s = await claimAndSend({ bookingId: b.id, col: "followupSentAt", template: "followup_review", now, send: () => tryFollowup(b.id), timeline: "Thank-you email sent" });
    if (s !== "taken") count(t, s);
  }
  return t;
}

async function reviewNudges(now: Date): Promise<Tally> {
  const db = await getDb();
  const t = tally();
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        inArray(bookings.status, ["confirmed", "completed"]),
        isNull(bookings.reviewRequestSentAt),
        lte(bookings.followupSentAt, new Date(now.getTime() - 4 * DAY)),
        gte(bookings.endAt, new Date(now.getTime() - 21 * DAY)),
      ),
    );
  if (!rows.length) return t;
  const reviewed = new Set(
    (await db.select({ id: reviews.bookingId }).from(reviews).where(inArray(reviews.bookingId, rows.map((r) => r.id)))).map((r) => r.id),
  );
  for (const b of rows) {
    if (!guestAutomationAllowed(b) || !reviewNudgeDue(b, now, reviewed.has(b.id))) continue;
    const s = await claimAndSend({ bookingId: b.id, col: "reviewRequestSentAt", template: "review_nudge", now, send: () => tryReviewNudge(b.id), timeline: "Review reminder sent" });
    if (s !== "taken") count(t, s);
  }
  return t;
}

async function abandonedCheckouts(now: Date): Promise<Tally> {
  const db = await getDb();
  const t = tally();
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.status, "expired"),
        eq(bookings.source, "direct"),
        isNull(bookings.abandonedEmailSentAt),
        lte(bookings.updatedAt, new Date(now.getTime() - 45 * 60_000)),
        gte(bookings.updatedAt, new Date(now.getTime() - DAY)),
      ),
    );
  for (const b of rows) {
    if (!guestAutomationAllowed(b)) continue;
    const [again] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          sql`lower(${bookings.contactEmail}) = ${b.contactEmail.toLowerCase()}`,
          gt(bookings.createdAt, b.createdAt),
          inArray(bookings.status, ["pending_payment", "confirmed", "completed"]),
        ),
      )
      .limit(1);
    const [byGuest] = await db
      .select({ id: bookingEvents.id })
      .from(bookingEvents)
      .where(and(eq(bookingEvents.bookingId, b.id), eq(bookingEvents.type, "expired"), eq(bookingEvents.message, "Cancelled before payment")))
      .limit(1);
    if (!abandonedDue(b, now, { rebooked: Boolean(again), cancelledByGuest: Boolean(byGuest) })) continue;
    const s = await claimAndSend({
      bookingId: b.id,
      col: "abandonedEmailSentAt",
      template: "abandoned_checkout",
      now,
      send: () => tryAbandonedCheckout(b.id),
      timeline: "Abandoned-checkout email sent",
    });
    if (s !== "taken") count(t, s);
  }
  return t;
}

async function giftCardDelivery(now: Date): Promise<Tally> {
  const db = await getDb();
  const t = tally();
  const rows = await db
    .select()
    .from(giftCards)
    .where(and(eq(giftCards.status, "active"), isNull(giftCards.deliveredAt), lte(giftCards.deliverAt, now), sql`${giftCards.recipientEmail} is not null`));
  for (const c of rows) {
    if (!giftCardDeliveryDue(c, now)) continue;
    const [claimed] = await db
      .update(giftCards)
      .set({ deliveredAt: now })
      .where(and(eq(giftCards.id, c.id), isNull(giftCards.deliveredAt)))
      .returning({ id: giftCards.id });
    if (!claimed) continue;
    const s = await tryGiftCardEmails(c.id, { purchaserReceipt: false, recipient: true });
    if (s === "failed") {
      const [f] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(emailLog)
        .where(and(eq(emailLog.template, "gift_card_recipient"), eq(emailLog.to, c.recipientEmail!), eq(emailLog.status, "failed")));
      if (Number(f?.n ?? 0) < MAX_SEND_ATTEMPTS) await db.update(giftCards).set({ deliveredAt: null }).where(eq(giftCards.id, c.id));
    }
    count(t, s);
  }
  return t;
}

async function hostDigest(now: Date): Promise<Tally> {
  const t = tally();
  const today = localDateKey(now);
  const last = await getSetting<string>("lastDigestDate");
  if (!digestDue(now, last, today)) return t;
  await setSetting("lastDigestDate", today); // claim for today
  const s = await tryHostDigest(now);
  if (s === "failed") await setSetting("lastDigestDate", last ?? "");
  count(t, s);
  return t;
}

const RUNNERS: Record<JobName, (now: Date) => Promise<Tally>> = {
  expireHolds: async (now) => ({ ...tally(), detail: { expired: await expireStaleHolds(now) } }),
  syncFeeds: async () => {
    const res = await syncCalendarFeeds();
    return { sent: 0, skipped: 0, failed: res.filter((r) => !r.ok).length, detail: res };
  },
  giftCardDelivery,
  reminders,
  abandonedCheckouts,
  followups,
  reviewNudges,
  hostDigest,
};

const LOCK = "cronLock";
const LOCK_TTL_MS = 9 * 60_000;

export type CronRun = { ok: boolean; startedAt: string; ms: number; locked?: boolean; jobs: JobResult[] };

/** Run every job (or `only` those named), in a safe order. Never throws. */
export async function runJobs(opts: { only?: JobName[]; now?: Date } = {}): Promise<CronRun> {
  const now = opts.now ?? new Date();
  const started = Date.now();
  if (!(await acquireLease(LOCK, LOCK_TTL_MS, now).catch(() => false))) {
    return { ok: true, locked: true, startedAt: now.toISOString(), ms: Date.now() - started, jobs: [] };
  }
  const jobs: JobResult[] = [];
  try {
    for (const job of JOBS) {
      if (opts.only && !opts.only.includes(job)) continue;
      const t0 = Date.now();
      try {
        const r = await RUNNERS[job](now);
        jobs.push({ job, ok: r.failed === 0, ms: Date.now() - t0, sent: r.sent, skipped: r.skipped, failed: r.failed, detail: r.detail });
      } catch (err) {
        console.error(`[cron] ${job} failed`, err);
        jobs.push({ job, ok: false, ms: Date.now() - t0, sent: 0, skipped: 0, failed: 0, error: err instanceof Error ? err.message : String(err) });
      }
    }
  } finally {
    await releaseLease(LOCK).catch(() => {});
  }
  await setSetting("lastCronRun", { at: now.toISOString(), ok: jobs.every((j) => j.ok) }).catch(() => {});
  return { ok: jobs.every((j) => j.ok), startedAt: now.toISOString(), ms: Date.now() - started, jobs };
}
