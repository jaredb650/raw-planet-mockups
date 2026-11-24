import { customAlphabet } from "nanoid";

// No 0/O/1/I/L to keep codes readable over the phone.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const short = customAlphabet(ALPHABET, 6);
const gift = customAlphabet(ALPHABET, 4);
const token = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 32);

export const newBookingCode = () => `RP-${short()}`;
export const newGiftCardCode = () => `RAW-${gift()}-${gift()}-${gift()}`;
export const newToken = () => token();

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}
