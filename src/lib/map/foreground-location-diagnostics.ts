type ForegroundLocationDiagEvent = {
  provider: "capacitor" | "browser" | null;
  sessionStartedAt: number | null;
  callbackAt?: number;
  positionTimestamp?: number;
  ageMs?: number;
  accuracyM?: number | null;
  latitude?: number;
  longitude?: number;
  accepted: boolean;
  rejectionReason?: string;
  timeToFirstTrustedMs?: number | null;
  note?: string;
};

declare global {
  interface Window {
    __SWITCH_IT_FG_LOC_DIAG__?: boolean;
  }
}

/**
 * Development-only foreground location diagnostics.
 * Coordinates are logged only when NODE_ENV=development (or explicit window flag).
 */
export function logForegroundLocationDiag(
  event: ForegroundLocationDiagEvent,
): void {
  const enabled =
    process.env.NODE_ENV === "development" ||
    (typeof window !== "undefined" && window.__SWITCH_IT_FG_LOC_DIAG__ === true);
  if (!enabled) {
    return;
  }

  const payload =
    process.env.NODE_ENV === "development"
      ? event
      : {
          ...event,
          latitude: undefined,
          longitude: undefined,
        };

  console.debug("[switch-it:fg-loc]", payload);
}
