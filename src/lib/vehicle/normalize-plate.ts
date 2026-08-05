/**
 * Israel-focused license plate helpers.
 * Storage uses digits only; display adds readable grouping.
 */

const SEPARATOR_PATTERN = /[\s\-–—._/\\|:;,'"`]+/g;
const NON_DIGIT_PATTERN = /\D/g;

/** Minimum / maximum digit count for MVP Israeli-style plates. */
export const PLATE_MIN_DIGITS = 5;
export const PLATE_MAX_DIGITS = 8;

export type PlateNormalizeResult =
  | { ok: true; normalized: string }
  | { ok: false; error: string };

export function normalizeLicensePlate(raw: string): PlateNormalizeResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "License plate is required." };
  }

  const withoutSeparators = trimmed.replace(SEPARATOR_PATTERN, "");
  if (NON_DIGIT_PATTERN.test(withoutSeparators)) {
    return {
      ok: false,
      error: "License plate may only contain digits and separators.",
    };
  }

  const digits = withoutSeparators.replace(NON_DIGIT_PATTERN, "");
  if (digits.length < PLATE_MIN_DIGITS || digits.length > PLATE_MAX_DIGITS) {
    return {
      ok: false,
      error: `License plate must be ${PLATE_MIN_DIGITS}–${PLATE_MAX_DIGITS} digits.`,
    };
  }

  return { ok: true, normalized: digits };
}

/**
 * Readable grouping without forcing a single national format.
 * Examples: 1234567 → 12-345-67, 12345678 → 123-45-678, 12345 → 12-345
 */
export function formatLicensePlateForDisplay(normalized: string): string {
  const digits = normalized.replace(NON_DIGIT_PATTERN, "");
  if (digits.length === 0) {
    return "";
  }

  if (digits.length === 7) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  }
  if (digits.length === 8) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }
  if (digits.length === 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  if (digits.length === 5) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }

  // Fallback: groups of 3 from the right.
  const parts: string[] = [];
  let rest = digits;
  while (rest.length > 3) {
    parts.unshift(rest.slice(-3));
    rest = rest.slice(0, -3);
  }
  if (rest.length > 0) {
    parts.unshift(rest);
  }
  return parts.join("-");
}
