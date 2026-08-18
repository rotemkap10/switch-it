/**
 * Publisher-controlled handoff timing.
 *
 * available_at = estimated departure (chosen at publish).
 * handoff_started_at = actual "I'm leaving now" (or implicit for "Now").
 * expires_at = current authoritative deadline:
 *   - before start: available_at + DEPARTURE_LATENESS_MINUTES
 *   - after start: handoff_started_at + INITIAL_HANDOFF_WINDOW_MINUTES
 *     (or + MAX after the single +2 extension)
 */

/** Initial live handoff window after the real start. */
export const INITIAL_HANDOFF_WINDOW_MINUTES = 3;

/** How late the publisher may still press "I'm leaving now". */
export const DEPARTURE_LATENESS_MINUTES = 3;

/** Absolute maximum live handoff after handoff_started_at. */
export const MAX_HANDOFF_WINDOW_MINUTES = 5;

/** The single publisher extension step. */
export const HANDOFF_EXTENSION_MINUTES = 2;

/** @deprecated Use INITIAL_HANDOFF_WINDOW_MINUTES. */
export const INITIAL_HANDOFF_GRACE_MINUTES = INITIAL_HANDOFF_WINDOW_MINUTES;

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

export type SpotAvailabilityWindow = {
  available_at: string;
  expires_at: string;
  handoff_started_at: string | null;
};

/**
 * Authoritative spot window from a trusted clock (server action / tests).
 * Do not call with untrusted client-supplied absolute timestamps.
 *
 * Delay 0 ("Now"): starts the live handoff immediately.
 * Future delay: estimated departure only — confirmation deadline is
 * available_at + DEPARTURE_LATENESS_MINUTES.
 */
export function computeSpotAvailabilityWindow(
  delayMinutes: number,
  now: Date = new Date(),
): SpotAvailabilityWindow {
  if (!isValidLeaveDelayMinutes(delayMinutes)) {
    throw new Error("INVALID_LEAVE_DELAY");
  }
  const availableAt = new Date(now.getTime() + delayMinutes * 60_000);
  if (delayMinutes === 0) {
    return {
      available_at: availableAt.toISOString(),
      expires_at: new Date(
        availableAt.getTime() + INITIAL_HANDOFF_WINDOW_MINUTES * 60_000,
      ).toISOString(),
      handoff_started_at: availableAt.toISOString(),
    };
  }
  return {
    available_at: availableAt.toISOString(),
    expires_at: new Date(
      availableAt.getTime() + DEPARTURE_LATENESS_MINUTES * 60_000,
    ).toISOString(),
    handoff_started_at: null,
  };
}

export function handoffHardCapMs(handoffStartedAtIso: string): number {
  const startedAt = new Date(handoffStartedAtIso).getTime();
  if (!Number.isFinite(startedAt)) {
    return Number.NaN;
  }
  return startedAt + MAX_HANDOFF_WINDOW_MINUTES * 60_000;
}

/**
 * How many ms can still be added to the current deadline (capped by step + hard cap).
 */
export function availableExtensionMs(
  handoffStartedAtIso: string,
  expiresAtIso: string,
): number {
  const expiresAt = new Date(expiresAtIso).getTime();
  const hardCap = handoffHardCapMs(handoffStartedAtIso);
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
  handoffStartedAtIso: string,
  expiresAtIso: string,
): string | null {
  const ms = availableExtensionMs(handoffStartedAtIso, expiresAtIso);
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
  return `Wait ${formatExtensionClock(ms)} more`;
}

/** True when the publisher may attempt an extension under product rules (client hint). */
export function canOfferHandoffExtension(options: {
  handoffStartedAtIso?: string | null;
  extensionUsedAtIso?: string | null;
  expiresAtIso: string;
  nowMs?: number;
  claimed: boolean;
}): boolean {
  if (!options.claimed) {
    return false;
  }
  const startedAtIso = options.handoffStartedAtIso;
  if (!startedAtIso || options.extensionUsedAtIso) {
    return false;
  }
  const now = options.nowMs ?? Date.now();
  const expiresAt = new Date(options.expiresAtIso).getTime();
  if (!Number.isFinite(expiresAt) || now >= expiresAt) {
    return false;
  }
  return availableExtensionMs(startedAtIso, options.expiresAtIso) > 0;
}
