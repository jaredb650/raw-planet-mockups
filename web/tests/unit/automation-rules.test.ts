import { describe, expect, it } from "vitest";
import {
  abandonedDue,
  digestDue,
  followupDue,
  giftCardDeliveryDue,
  guestAutomationAllowed,
  inSendingHours,
  reminderDue,
  reviewNudgeDue,
} from "@/lib/automation/rules";
import { realAddress } from "@/emails/view";

const H = 3600_000;
const D = 24 * H;
// Saturday Nov 14 2026, 2pm New York (EST) session.
const START = new Date("2026-11-14T19:00:00Z");
const END = new Date(START.getTime() + 2 * H);
const at = (ms: number) => new Date(START.getTime() + ms);

describe("guestAutomationAllowed", () => {
  it("skips platform bookings and placeholder addresses", () => {
    expect(guestAutomationAllowed({ source: "direct", contactEmail: "a@b.com" })).toBe(true);
    expect(guestAutomationAllowed({ source: "manual", contactEmail: "a@b.com" })).toBe(true);
    expect(guestAutomationAllowed({ source: "airbnb", contactEmail: "a@b.com" })).toBe(false);
    expect(guestAutomationAllowed({ source: "viator", contactEmail: "a@b.com" })).toBe(false);
    expect(guestAutomationAllowed({ source: "direct", contactEmail: "guest@airbnb.invalid" })).toBe(false);
  });
});

describe("reminderDue", () => {
  const b = { status: "confirmed", startAt: START, reminderSentAt: null, confirmedAt: new Date(START.getTime() - 5 * D), createdAt: new Date(START.getTime() - 5 * D) };
  it("fires from 24h before until 1h before", () => {
    expect(reminderDue(b, at(-25 * H))).toBe(false);
    expect(reminderDue(b, at(-24 * H))).toBe(true);
    expect(reminderDue(b, at(-2 * H))).toBe(true);
    expect(reminderDue(b, at(-30 * 60_000))).toBe(false);
  });
  it("not twice, not for cancelled bookings", () => {
    expect(reminderDue({ ...b, reminderSentAt: at(-23 * H) }, at(-20 * H))).toBe(false);
    expect(reminderDue({ ...b, status: "cancelled" }, at(-20 * H))).toBe(false);
  });
  it("skips last-minute bookings (confirmation is enough)", () => {
    const late = { ...b, confirmedAt: at(-10 * H), createdAt: at(-10 * H) };
    expect(reminderDue(late, at(-5 * H))).toBe(false);
  });
});

describe("followupDue", () => {
  const b = { status: "completed", endAt: END, followupSentAt: null };
  it("3h after the end, during sending hours (9am–8pm NY)", () => {
    // END = 4pm NY. +3h = 7pm NY → inside hours.
    expect(followupDue(b, new Date(END.getTime() + 2 * H))).toBe(false);
    expect(followupDue(b, new Date(END.getTime() + 3 * H))).toBe(true);
    // 11pm NY → wait for the morning
    expect(followupDue(b, new Date(END.getTime() + 7 * H))).toBe(false);
    // next day 9:30am NY
    expect(followupDue(b, new Date("2026-11-15T14:30:00Z"))).toBe(true);
  });
  it("never for no-shows, cancelled, or after a week", () => {
    expect(followupDue({ ...b, status: "no_show" }, new Date("2026-11-15T15:00:00Z"))).toBe(false);
    expect(followupDue({ ...b, status: "cancelled" }, new Date("2026-11-15T15:00:00Z"))).toBe(false);
    expect(followupDue(b, new Date("2026-11-22T15:00:00Z"))).toBe(false);
  });
});

describe("reviewNudgeDue", () => {
  const sent = new Date("2026-11-15T15:00:00Z");
  const b = { status: "completed", endAt: END, followupSentAt: sent, reviewRequestSentAt: null };
  it("4+ days after the thank-you, once, only without a review", () => {
    expect(reviewNudgeDue(b, new Date("2026-11-18T15:00:00Z"), false)).toBe(false);
    expect(reviewNudgeDue(b, new Date("2026-11-19T15:00:00Z"), false)).toBe(true);
    expect(reviewNudgeDue(b, new Date("2026-11-19T15:00:00Z"), true)).toBe(false);
    expect(reviewNudgeDue({ ...b, reviewRequestSentAt: sent }, new Date("2026-11-19T15:00:00Z"), false)).toBe(false);
    expect(reviewNudgeDue({ ...b, followupSentAt: null }, new Date("2026-11-19T15:00:00Z"), false)).toBe(false);
  });
  it("gives up 21 days after the session", () => {
    expect(reviewNudgeDue(b, new Date("2026-12-06T15:00:00Z"), false)).toBe(false);
  });
});

describe("abandonedDue", () => {
  const expiredAt = new Date("2026-11-04T15:00:00Z");
  const b = { status: "expired", source: "direct", abandonedEmailSentAt: null, updatedAt: expiredAt, startAt: START };
  const ok = { rebooked: false, cancelledByGuest: false };
  it("45 min to 24h after expiry", () => {
    expect(abandonedDue(b, new Date(expiredAt.getTime() + 30 * 60_000), ok)).toBe(false);
    expect(abandonedDue(b, new Date(expiredAt.getTime() + 45 * 60_000), ok)).toBe(true);
    expect(abandonedDue(b, new Date(expiredAt.getTime() + 25 * H), ok)).toBe(false);
  });
  it("not if they rebooked, cancelled themselves, or the session is under 24h away", () => {
    const now = new Date(expiredAt.getTime() + H);
    expect(abandonedDue(b, now, { ...ok, rebooked: true })).toBe(false);
    expect(abandonedDue(b, now, { ...ok, cancelledByGuest: true })).toBe(false);
    expect(abandonedDue({ ...b, startAt: new Date(now.getTime() + 10 * H) }, now, ok)).toBe(false);
    expect(abandonedDue({ ...b, source: "manual" }, now, ok)).toBe(false);
  });
});

describe("giftCardDeliveryDue", () => {
  const c = { status: "active", recipientEmail: "r@x.com", deliverAt: new Date("2026-12-25T14:00:00Z"), deliveredAt: null };
  it("on or after the delivery time, once", () => {
    expect(giftCardDeliveryDue(c, new Date("2026-12-25T13:59:00Z"))).toBe(false);
    expect(giftCardDeliveryDue(c, new Date("2026-12-25T14:00:00Z"))).toBe(true);
    expect(giftCardDeliveryDue({ ...c, deliveredAt: new Date() }, new Date("2026-12-26T00:00:00Z"))).toBe(false);
    expect(giftCardDeliveryDue({ ...c, status: "void" }, new Date("2026-12-26T00:00:00Z"))).toBe(false);
  });
});

describe("digest + sending hours", () => {
  it("digest once per NY day from 7am", () => {
    expect(digestDue(new Date("2026-11-14T11:30:00Z"), "2026-11-13", "2026-11-14")).toBe(false); // 6:30am EST
    expect(digestDue(new Date("2026-11-14T12:05:00Z"), "2026-11-13", "2026-11-14")).toBe(true); // 7:05am
    expect(digestDue(new Date("2026-11-14T12:05:00Z"), "2026-11-14", "2026-11-14")).toBe(false);
    expect(digestDue(new Date("2026-07-14T11:05:00Z"), null, "2026-07-14")).toBe(true); // 7:05am EDT
  });
  it("sending hours follow New York, not the server", () => {
    expect(inSendingHours(new Date("2026-07-14T13:00:00Z"))).toBe(true); // 9am EDT
    expect(inSendingHours(new Date("2026-11-14T13:00:00Z"))).toBe(false); // 8am EST
  });
});

describe("realAddress", () => {
  it("treats seed placeholders and area-only strings as unknown", () => {
    expect(realAddress("East Village, New York, NY 10009 (exact address sent with your confirmation)")).toBeNull();
    expect(realAddress("Venue confirmed with your booking")).toBeNull();
    expect(realAddress("Manhattan, New York, NY")).toBeNull();
    expect(realAddress("")).toBeNull();
    expect(realAddress("123 Sample St, Studio 4, New York, NY 10009")).toBe("123 Sample St, Studio 4, New York, NY 10009");
  });
});
