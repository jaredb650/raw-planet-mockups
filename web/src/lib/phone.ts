/**
 * Phone number normalization & validation shared across admin settings,
 * customer/booking forms, and public checkout.
 *
 * Copy-pasting from iOS/macOS Contacts, Messages, or WhatsApp often embeds
 * invisible Unicode directional marks (U+202A..U+202E, U+200E, U+2066..U+2069),
 * non-breaking spaces (U+00A0, U+202F), or Unicode dashes (–, —, ‑, −).
 * Strip/normalize those first so real numbers never trip validation.
 */

export function cleanPhone(raw: string): string {
  return raw
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u00A0\u202F\u2000-\u200A]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isValidPhone(cleaned: string): boolean {
  if (!cleaned) return true;
  if (cleaned.length > 40) return false;
  if (!/^[+\d\s().-]+$/.test(cleaned)) return false;
  const digits = cleaned.match(/\d/g)?.length ?? 0;
  return digits >= 7;
}

export function parsePhone(raw: string, label?: string): string {
  const cleaned = cleanPhone(raw);
  if (!cleaned) return "";
  if (cleaned.length > 40) {
    throw new Error(`${label ? `${label}: ` : ""}That phone number is too long.`);
  }
  if (!isValidPhone(cleaned)) {
    throw new Error(`${label ? `${label}: ` : ""}Enter a valid phone number (digits, spaces, +, -, or parentheses).`);
  }
  return cleaned;
}
