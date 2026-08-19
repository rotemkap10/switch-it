export const GENERIC_APP_ERROR =
  "Something went wrong. Please try again." as const;

export const NETWORK_APP_ERROR =
  "We couldn’t reach the server. Check your connection and try again." as const;

/**
 * Canonical friendly messages for stable application / RPC error codes.
 * Never expose raw Supabase, SQL, UUIDs, or status enums to the UI.
 */
export const APP_ERROR_MESSAGES = {
  VEHICLE_PROFILE_REQUIRED: "Add your vehicle details before continuing.",
  SPOT_UNAVAILABLE: "This spot was just claimed by another driver.",
  SPOT_NOT_FOUND: "This parking spot is no longer available.",
  SPOT_EXPIRED: "This parking spot is no longer available.",
  SELF_CLAIM: "You cannot claim your own parking spot.",
  ACTIVE_CLAIM_EXISTS: "You already have an active parking claim.",
  OPEN_SPOT_EXISTS: "You already have an active parking spot.",
  INSUFFICIENT_CREDITS:
    "This handoff needs 1 parking credit.",
  CLAIM_TOO_FAR: "This spot is too far away to claim.",
  LOCATION_REQUIRED: "Live location is required during a parking handoff.",
  INVALID_PLATE_DIGITS: "Those digits don't match.",
  INVALID_HANDOFF_CODE: "Those digits don't match.",
  HANDOFF_TEMPORARILY_LOCKED:
    "Too many incorrect attempts. Try again in a moment.",
  HANDOFF_UNAVAILABLE: "This handoff can no longer be completed.",
  HANDOFF_NOT_READY: "You can extend waiting once the handoff has started.",
  HANDOFF_NOT_STARTED: "The handoff has not started yet.",
  CLAIM_EXPIRED: "This handoff can no longer be completed.",
  CLAIM_NOT_ACTIVE: "This handoff can no longer be completed.",
  CLAIM_NOT_FOUND: "This handoff can no longer be completed.",
  NOT_SEEKER: "Only the claiming driver can manage this handoff.",
  NOT_OWNER: "Only the publisher can manage this parking spot.",
  NOT_HANDOFF_PARTICIPANT: "This handoff is no longer available.",
  SPOT_NOT_CANCELLABLE: "This spot can no longer be cancelled.",
  INVALID_CANCEL_REASON: "Choose a reason to continue.",
  ALREADY_RELEASED_THIS_SPOT: "You already released this spot.",
  NOT_AUTHENTICATED: "Your session has expired. Please sign in again.",
  PROFILE_NOT_FOUND: GENERIC_APP_ERROR,
  INCONSISTENT_COMPLETION_STATE: GENERIC_APP_ERROR,
  INCONSISTENT_STATE: GENERIC_APP_ERROR,
  NETWORK: NETWORK_APP_ERROR,
} as const;

export type AppErrorCode = keyof typeof APP_ERROR_MESSAGES;

/** Codes that should stay next to the handoff input — not toasted. */
export const INLINE_HANDOFF_ERROR_CODES: ReadonlySet<string> = new Set([
  "INVALID_PLATE_DIGITS",
  "INVALID_HANDOFF_CODE",
  "HANDOFF_TEMPORARILY_LOCKED",
]);

const KNOWN_CODES = Object.keys(APP_ERROR_MESSAGES) as AppErrorCode[];

export type AppErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export type MappedAppError = {
  code: AppErrorCode | "UNKNOWN";
  message: string;
};

function haystackFromError(error: AppErrorLike): string {
  return [error.message, error.details, error.hint].filter(Boolean).join(" ");
}

export function findAppErrorCode(haystack: string): AppErrorCode | null {
  for (const code of KNOWN_CODES) {
    if (haystack.includes(code)) {
      return code;
    }
  }
  return null;
}

export function isNetworkishFailure(error: AppErrorLike | null | undefined): boolean {
  if (!error) {
    return false;
  }
  const haystack = haystackFromError(error).toLowerCase();
  return (
    haystack.includes("fetch failed") ||
    haystack.includes("network") ||
    haystack.includes("failed to fetch") ||
    haystack.includes("load failed") ||
    error.code === "ECONNREFUSED" ||
    error.code === "ETIMEDOUT"
  );
}

/**
 * Map a PostgREST / RPC error (or code string) to a safe user-facing message.
 * Never returns raw database text.
 */
export function mapAppError(
  error: AppErrorLike | string | null | undefined,
  fallback: string = GENERIC_APP_ERROR,
): MappedAppError {
  if (!error) {
    return { code: "UNKNOWN", message: fallback };
  }

  if (typeof error === "string") {
    if (error in APP_ERROR_MESSAGES) {
      const code = error as AppErrorCode;
      return { code, message: APP_ERROR_MESSAGES[code] };
    }
    const fromHaystack = findAppErrorCode(error);
    if (fromHaystack) {
      return {
        code: fromHaystack,
        message: APP_ERROR_MESSAGES[fromHaystack],
      };
    }
    return { code: "UNKNOWN", message: fallback };
  }

  if (isNetworkishFailure(error)) {
    return { code: "NETWORK", message: APP_ERROR_MESSAGES.NETWORK };
  }

  const haystack = haystackFromError(error);

  if (error.code === "23505") {
    if (haystack.includes("claims_one_active_per_spot")) {
      return {
        code: "SPOT_UNAVAILABLE",
        message: APP_ERROR_MESSAGES.SPOT_UNAVAILABLE,
      };
    }
    if (haystack.includes("claims_one_active_per_seeker")) {
      return {
        code: "ACTIVE_CLAIM_EXISTS",
        message: APP_ERROR_MESSAGES.ACTIVE_CLAIM_EXISTS,
      };
    }
    if (haystack.includes("parking_spots") || haystack.includes("one_open")) {
      return {
        code: "OPEN_SPOT_EXISTS",
        message: APP_ERROR_MESSAGES.OPEN_SPOT_EXISTS,
      };
    }
    if (
      haystack.includes("credit_tx_one_debit_per_claim") ||
      haystack.includes("credit_tx_one_credit_per_claim")
    ) {
      return {
        code: "INCONSISTENT_COMPLETION_STATE",
        message: APP_ERROR_MESSAGES.INCONSISTENT_COMPLETION_STATE,
      };
    }
  }

  const matched = findAppErrorCode(haystack);
  if (matched) {
    return { code: matched, message: APP_ERROR_MESSAGES[matched] };
  }

  return { code: "UNKNOWN", message: fallback };
}

export function appErrorMessage(
  error: AppErrorLike | string | null | undefined,
  fallback: string = GENERIC_APP_ERROR,
): string {
  return mapAppError(error, fallback).message;
}
