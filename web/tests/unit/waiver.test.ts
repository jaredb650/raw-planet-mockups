import { describe, expect, it } from "vitest";
import { alreadySigned, signingState, WAIVER_COPY, waiverSignerLimit, waiverSnapshot, waiverVersion } from "@/lib/waiver";
import { verifyWaiverToken, waiverToken, waiverUrlFor } from "@/lib/waiver-token";
import { reviewToken } from "@/lib/review-token";

describe("waiver token", () => {
  it("accepts its own booking's token only", () => {
    expect(verifyWaiverToken("b1", waiverToken("b1"))).toBe(true);
    expect(verifyWaiverToken("b2", waiverToken("b1"))).toBe(false);
    expect(verifyWaiverToken("b1", "")).toBe(false);
    expect(verifyWaiverToken("b1", waiverToken("b1").slice(0, -1))).toBe(false);
  });

  it("is not interchangeable with the review token", () => {
    expect(waiverToken("b1")).not.toBe(reviewToken("b1"));
    expect(verifyWaiverToken("b1", reviewToken("b1"))).toBe(false);
  });

  it("rejects a same-length non-ASCII token without throwing", () => {
    expect(verifyWaiverToken("b1", "é".repeat(32))).toBe(false);
  });

  it("puts the token in the signing link", () => {
    expect(waiverUrlFor({ id: "b1", code: "RP-ABC123" })).toContain(`/waiver/RP-ABC123?t=${waiverToken("b1")}`);
  });
});

describe("signer limit", () => {
  const confirmed = { status: "confirmed", guests: 3 };

  it("stays open up to the guest count plus slack, then fills", () => {
    const limit = waiverSignerLimit(3);
    expect(limit).toBeGreaterThan(3);
    expect(signingState(confirmed, 3)).toBe("open");
    expect(signingState(confirmed, limit - 1)).toBe("open");
    expect(signingState(confirmed, limit)).toBe("full");
  });

  it("closes for anything but a live or finished booking, even with room left", () => {
    for (const status of ["cancelled", "expired", "pending_payment", "no_show"]) expect(signingState({ status, guests: 3 }, 0)).toBe("closed");
    expect(signingState({ status: "completed", guests: 3 }, 0)).toBe("open");
  });
});

describe("alreadySigned", () => {
  const existing = [{ signerName: "Ana  Ruiz", minorName: null }];

  it("treats the same person again as a repeat, ignoring case and spacing", () => {
    expect(alreadySigned(existing, { signerName: " ana ruiz ", minorName: null })).toBe(true);
    expect(alreadySigned(existing, { signerName: "Ben Ruiz", minorName: null })).toBe(false);
  });

  it("lets one parent sign for each minor", () => {
    const parent = [{ signerName: "Ana Ruiz", minorName: "Leo" }];
    expect(alreadySigned(parent, { signerName: "Ana Ruiz", minorName: "Mia" })).toBe(false);
    expect(alreadySigned(parent, { signerName: "Ana Ruiz", minorName: "leo" })).toBe(true);
  });
});

describe("waiver wording", () => {
  it("snapshots every clause in each language, tagged with the language", () => {
    for (const lang of ["en", "es"] as const) {
      const c = WAIVER_COPY[lang];
      const text = waiverSnapshot(lang);
      for (const s of [...c.sections, c.recording, c.minor]) expect(text).toContain(s.body);
      expect(waiverVersion(lang).endsWith(`-${lang}`)).toBe(true);
    }
  });
});
