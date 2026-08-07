/**
 * Publisher-controlled handoff waiting window.
 *
 * New spots start with a short initial grace after available_at.
 * The publisher may extend in steps up to a hard maximum.
 * Existing spots published under the old +5 default keep their expires_at
 * until they naturally end — do not shorten them at deploy time.
 */

/** Initial grace after available_at for newly published spots. */
export const INITIAL_HANDOFF_GRACE_MINUTES = 2;

/** Absolute maximum handoff lifetime after available_at. */
export const MAX_HANDOFF_WINDOW_MINUTES = 5;

/** Each successful “Wait more” extends by at most this many minutes. */
export const HANDOFF_EXTENSION_MINUTES = 2;

export const LEAVE_DELAY_MIN_MINUTES = 0;
/** Near-real-time publish horizon — newly published spots only. */
export const LEAVE_DELAY_MAX_MINUTES = 10;

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
 *
 * New publishes: expires_at = available_at + INITIAL_HANDOFF_GRACE_MINUTES.
 * Hard cap for extensions: available_at + MAX_HANDOFF_WINDOW_MINUTES.
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
    availableAt.getTime() + INITIAL_HANDOFF_GRACE_MINUTES * 60_000,
  );
  return {
    available_at: availableAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  };
}

export function handoffHardCapMs(availableAtIso: string): number {
  const availableAt = new Date(availableAtIso).getTime();
  if (!Number.isFinite(availableAt)) {
    return Number.NaN;
  }
  return availableAt + MAX_HANDOFF_WINDOW_MINUTES * 60_000;
}

/**
 * How many ms can still be added to the current deadline (capped by step + hard cap).
 */
export function availableExtensionMs(
  availableAtIso: string,
  expiresAtIso: string,
): number {
  const expiresAt = new Date(expiresAtIso).getTime();
  const hardCap = handoffHardCapMs(availableAtIso);
  if (!Number.isFinite(expiresAt) || !Number.isFinite(hardCap)) {
    return 0;
  }
  const headroom = hardCap - expiresAt;
  if (headroom <= 0) {
    return 0;
  }
  return Math.min(HANDOFF_EXTENSION_MINUTES * 60_000, headroom);
}

function formatExtensionClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Publisher extend-button label, or null when no extension is available.
 * Never promises more time than can legally be added.
 */
export function formatHandoffExtensionButtonLabel(
  availableAtIso: string,
  expiresAtIso: string,
): string | null {
  const ms = availableExtensionMs(availableAtIso, expiresAtIso);
  if (ms <= 0) {
    return null;
  }
  const fullStepMs = HANDOFF_EXTENSION_MINUTES * 60_000;
  if (ms >= fullStepMs) {
    return "Wait 2 more min";
  }
  if (ms === 60_000) {
    return "Wait 1 more min";
  }
  if (ms > 60_000 && ms % 60_000 === 0) {
    return `Wait ${ms / 60_000} more min`;
  }
  if (ms >= 60_000) {
    // e.g. 90s remaining headroom — truthful clock, not “2 more min”.
    return `Wait ${formatExtensionClock(ms)} more`;
  }
  return `Wait ${formatExtensionClock(ms)} more`;
}

/** True when the publisher may attempt an extension under product rules (client hint). */
export function canOfferHandoffExtension(options: {
  availableAtIso: string;
  expiresAtIso: string;
  nowMs?: number;
  claimed: boolean;
}): boolean {
  if (!options.claimed) {
    return false;
  }
  const now = options.nowMs ?? Date.now();
  const availableAt = new Date(options.availableAtIso).getTime();
  const expiresAt = new Date(options.expiresAtIso).getTime();
  if (
    !Number.isFinite(availableAt) ||
    !Number.isFinite(expiresAt) ||
    now < availableAt ||
    now >= expiresAt
  ) {
    return false;
  }
  return availableExtensionMs(options.availableAtIso, options.expiresAtIso) > 0;
}
