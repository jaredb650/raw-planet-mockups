import { describe, expect, it } from "vitest";
import { cleanPhone, isValidPhone, parsePhone } from "@/lib/phone";

describe("phone helper", () => {
  it("strips invisible Apple/iOS Contacts bidi marks and normalizes dashes/spaces", () => {
    const pasted = "\u202A+1\u00A0(917)\u202F555\u20130142\u202C";
    expect(cleanPhone(pasted)).toBe("+1 (917) 555-0142");
    expect(parsePhone(pasted, "Phone")).toBe("+1 (917) 555-0142");
  });

  it("allows empty values", () => {
    expect(parsePhone("   ", "Phone")).toBe("");
    expect(isValidPhone("")).toBe(true);
  });

  it("accepts common US and international formats", () => {
    for (const n of ["(917) 555-0142", "+1 917 555 0142", "917.555.0142", "9175550142", "+44 20 7946 0958"]) {
      expect(parsePhone(n)).toBe(n);
    }
  });

  it("rejects letters or too-few digits with a clear field-labeled message", () => {
    expect(() => parsePhone("Same as phone", "WhatsApp")).toThrow(/WhatsApp:.*valid phone number/i);
    expect(() => parsePhone("12345", "Phone")).toThrow(/Phone:.*valid phone number/i);
    expect(() => parsePhone("+---", "Phone")).toThrow(/Phone:.*valid phone number/i);
  });
});
