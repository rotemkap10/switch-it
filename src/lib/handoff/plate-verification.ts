export const PLATE_VERIFICATION_MAX_ATTEMPTS = 3;
export const PLATE_VERIFICATION_LOCK_MINUTES = 2;

export const INVALID_PLATE_DIGITS_FALLBACK = "Those digits don't match.";
export const PLATE_VERIFICATION_LOCKED_MESSAGE =
  "Too many incorrect attempts. Try again in a moment.";

const ATTEMPTS_REMAINING_PATTERN = /attempts_remaining=(\d+)/;

export function parseAttemptsRemaining(
  error: {
    details?: string | null;
    hint?: string | null;
    message?: string | null;
  } | null | undefined,
): number | null {
  if (!error) {
    return null;
  }
  const haystack = [error.details, error.hint, error.message]
    .filter(Boolean)
    .join(" ");
  const match = haystack.match(ATTEMPTS_REMAINING_PATTERN);
  if (!match) {
    return null;
  }
  const remaining = Number.parseInt(match[1]!, 10);
  if (!Number.isFinite(remaining) || remaining < 0) {
    return null;
  }
  return remaining;
}

export function invalidPlateDigitsMessage(
  attemptsRemaining: number | null,
): string {
  if (attemptsRemaining === 1) {
    return "Those digits don't match. 1 attempt remaining.";
  }
  if (attemptsRemaining != null && attemptsRemaining > 0) {
    return `Those digits don't match. ${attemptsRemaining} attempts remaining.`;
  }
  return INVALID_PLATE_DIGITS_FALLBACK;
}
