import { describe, expect, it } from "vitest";
import { pullQuote } from "@/components/site/format";
import { reviewEligibility } from "@/components/site/queries";

describe("pullQuote", () => {
  it("passes short reviews through", () => {
    expect(pullQuote("Loved it!")).toEqual({ text: "Loved it!", trimmed: false });
  });
  it("keeps first and last sentence of a long review, dropping a leading ellipsis", () => {
    const body =
      "This was the BEST NYC experience we've ever had! Cristian has that unique ability to make you feel comfortable right away (which is important when you are in a creative space!). He was knowledgeable, accommodating and fun! ... The best NYC souvenir we could dream of- a recorded track that we created!";
    expect(pullQuote(body)).toEqual({
      text: "This was the BEST NYC experience we've ever had! … The best NYC souvenir we could dream of- a recorded track that we created!",
      trimmed: true,
    });
  });
  it("cuts at a word boundary when there is no sentence break", () => {
    const r = pullQuote("word ".repeat(80), 40);
    expect(r.trimmed).toBe(true);
    expect(r.text.endsWith(" …")).toBe(true);
    expect(r.text.length).toBeLessThanOrEqual(42);
  });
});

describe("reviewEligibility", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  const past = new Date("2026-11-03T12:00:00Z");
  const future = new Date("2026-11-05T12:00:00Z");
  it("allows completed and finished confirmed sessions", () => {
    expect(reviewEligibility({ status: "completed", endAt: future }, now)).toEqual({ ok: true });
    expect(reviewEligibility({ status: "confirmed", endAt: past }, now)).toEqual({ ok: true });
  });
  it("waits for upcoming sessions and refuses cancelled ones", () => {
    expect(reviewEligibility({ status: "confirmed", endAt: future }, now)).toEqual({ ok: false, reason: "not_yet" });
    expect(reviewEligibility({ status: "cancelled", endAt: past }, now)).toEqual({ ok: false, reason: "cancelled" });
    expect(reviewEligibility({ status: "pending_payment", endAt: past }, now)).toEqual({ ok: false, reason: "cancelled" });
  });
});
