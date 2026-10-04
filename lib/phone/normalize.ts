import { parsePhoneNumberFromString } from "libphonenumber-js/min";

export type NormalisedPhone = { e164: string; display: string };

/**
 * Normalise a customer WhatsApp number (spec §6.4).
 * 7 digits → Guyana local; 10 digits starting 592 → +592; "+…" kept if 8–15 digits.
 */
export function normalisePhone(raw: string): NormalisedPhone | null {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+") || trimmed.startsWith("00");
  const digits = trimmed.replace(/\D/g, "").replace(/^00/, "");

  let candidate: string;
  if (hasPlus) {
    if (digits.length < 8 || digits.length > 15) return null;
    candidate = `+${digits}`;
  } else if (digits.length === 7) {
    candidate = `+592${digits}`;
  } else if (digits.length === 10 && digits.startsWith("592")) {
    candidate = `+${digits}`;
  } else {
    return null;
  }

  const parsed = parsePhoneNumberFromString(candidate, "GY");
  if (!parsed || !parsed.isPossible()) return null;
  if (parsed.countryCallingCode === "592" && !parsed.isValid()) return null;
  return { e164: parsed.number, display: parsed.formatInternational() };
}

export const PHONE_ERROR = "Please enter a valid WhatsApp number";
