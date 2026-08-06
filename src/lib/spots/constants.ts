/** Shared handoff window after available_at (Model 1). */
export const SPOT_GRACE_MINUTES = 5;

/** Alias used in product copy / docs. */
export const HANDOFF_WINDOW_MINUTES = SPOT_GRACE_MINUTES;

export const LEAVE_DELAY_MIN_MINUTES = 0;
export const LEAVE_DELAY_MAX_MINUTES = 20;

/** @deprecated Use LEAVE_DELAY_MIN/MAX — kept as inclusive range helper. */
export const AVAILABLE_IN_MINUTES_MIN = LEAVE_DELAY_MIN_MINUTES;
export const AVAILABLE_IN_MINUTES_MAX = LEAVE_DELAY_MAX_MINUTES;

export const GEOLOCATION_TIMEOUT_MS = 10_000;

export type LeaveDelayMinutes = number;

export function isValidLeaveDelayMinutes(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= LEAVE_DELAY_MIN_MINUTES &&
    value <= LEAVE_DELAY_MAX_MINUTES
  );
}

/**
 * Authoritative spot window from a trusted clock (server action / tests).
 * Do not call with untrusted client-supplied absolute timestamps.
 */
export function computeSpotAvailabilityWindow(
  delayMinutes: number,
  now: Date = new Date(),
): { available_at: string; expires_at: string } {
  if (!isValidLeaveDelayMinutes(delayMinutes)) {
    throw new Error("INVALID_LEAVE_DELAY");
  }
  const availableAt = new Date(now.getTime() + delayMinutes * 60_000);
  const expiresAt = new Date(
    availableAt.getTime() + HANDOFF_WINDOW_MINUTES * 60_000,
  );
  return {
    available_at: availableAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  };
}
