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

const NON_DIGIT_OR_MASK = /[^0-9*]/g;

/**
 * Last two digits of a stored (normalized) plate. Comparison-only helper;
 * never send this value to a counterpart client.
 */
export function licensePlateSuffix(normalized: string): string | null {
  const digits = normalized.replace(NON_DIGIT_PATTERN, "");
  if (digits.length < 2) {
    return null;
  }
  return digits.slice(-2);
}

/**
 * True when a display string is a masked plate (visible prefix + `**`)
 * and does not contain the hidden digits.
 */
export function isMaskedLicensePlateDisplay(value: string): boolean {
  const compact = value.replace(NON_DIGIT_OR_MASK, "");
  return /^\d+\*{2}$/.test(compact) && compact.length >= 3;
}

/**
 * Format a stored plate with the last two digits replaced by `**`.
 * Example: `1234567` → `12-345-**`.
 */
export function maskLicensePlateForHandoff(normalized: string): string | null {
  const digits = normalized.replace(NON_DIGIT_PATTERN, "");
  if (digits.length < 2) {
    return null;
  }

  const formatted = formatLicensePlateForDisplay(digits);
  let remaining = 2;
  let masked = "";
  for (let index = formatted.length - 1; index >= 0; index -= 1) {
    const character = formatted[index]!;
    if (remaining > 0 && character >= "0" && character <= "9") {
      masked = `*${masked}`;
      remaining -= 1;
    } else {
      masked = `${character}${masked}`;
    }
  }
  return isMaskedLicensePlateDisplay(masked) ? masked : null;
}
