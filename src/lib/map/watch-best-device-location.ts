import { haversineDistanceMeters } from "@/lib/map/distance";
import type { DeviceLocationFix } from "@/lib/map/request-current-device-location";
import {
  geolocationErrorCodeToReason,
  type GeolocationReason,
} from "@/lib/map/use-user-location";

/** Publisher-facing accuracy bands (meters). */
export const GPS_ACCURACY_GOOD_MAX_M = 15;
export const GPS_ACCURACY_ACCEPTABLE_MAX_M = 30;
/** Stop watching early once a fix is this good or better. */
export const GPS_ACCURACY_GOOD_ENOUGH_M = 10;
/** Wall-clock cap for watchPosition during publish. */
export const GPS_WATCH_TIMEOUT_MS = 12_000;
/**
 * iOS WKWebView often delivers a cached sample as the first watchPosition
 * callback even with maximumAge: 0. Treat older timestamps as not current.
 */
export const GPS_STALE_FIX_MAX_AGE_MS = 15_000;
/** Keep listening briefly so a cached first sample can be replaced. */
export const GPS_MIN_WATCH_MS = 2_000;
/** A later sample this far away is a new place, not GPS jitter. */
export const GPS_MOVED_SIGNIFICANTLY_M = 50;

export type GpsAccuracyBand = "good" | "acceptable" | "poor" | "unknown";

export function classifyGpsAccuracy(
  accuracyM: number | null | undefined,
): GpsAccuracyBand {
  if (accuracyM == null || !Number.isFinite(accuracyM) || accuracyM <= 0) {
    return "unknown";
  }
  if (accuracyM <= GPS_ACCURACY_GOOD_MAX_M) {
    return "good";
  }
  if (accuracyM <= GPS_ACCURACY_ACCEPTABLE_MAX_M) {
    return "acceptable";
  }
  return "poor";
}

export function formatGpsAccuracyLabel(
  accuracyM: number | null | undefined,
): string | null {
  if (accuracyM == null || !Number.isFinite(accuracyM) || accuracyM <= 0) {
    return null;
  }
  return `Location accuracy: ±${Math.round(accuracyM)} m`;
}

export function isStaleGpsFix(
  fix: DeviceLocationFix,
  now = Date.now(),
): boolean {
  if (!Number.isFinite(fix.timestamp) || fix.timestamp <= 0) {
    return false;
  }
  return now - fix.timestamp > GPS_STALE_FIX_MAX_AGE_MS;
}

export function isBetterGpsFix(
  candidate: DeviceLocationFix,
  current: DeviceLocationFix | null,
  now = Date.now(),
): boolean {
  if (!current) {
    return true;
  }

  const candidateStale = isStaleGpsFix(candidate, now);
  const currentStale = isStaleGpsFix(current, now);
  if (!candidateStale && currentStale) {
    return true;
  }
  if (candidateStale && !currentStale) {
    return false;
  }

  const moved =
    haversineDistanceMeters(
      { latitude: candidate.latitude, longitude: candidate.longitude },
      { latitude: current.latitude, longitude: current.longitude },
    ) >= GPS_MOVED_SIGNIFICANTLY_M;
  const newerBy = candidate.timestamp - current.timestamp;

  // Cached high-accuracy point at the old place must not beat a live sample
  // after the user has moved. iOS may stamp both with "now".
  if (!candidateStale && moved && newerBy >= 0) {
    const next = candidate.accuracy;
    if (
      next != null &&
      Number.isFinite(next) &&
      next <= GPS_ACCURACY_ACCEPTABLE_MAX_M * 2
    ) {
      return true;
    }
  }

  const next = candidate.accuracy;
  const prev = current.accuracy;
  if (next == null || !Number.isFinite(next)) {
    return false;
  }
  if (prev == null || !Number.isFinite(prev)) {
    return true;
  }
  return next < prev - 0.5;
}

export type WatchBestDeviceLocationOptions = {
  onUpdate: (fix: DeviceLocationFix) => void;
  onError: (reason: GeolocationReason) => void;
  onSettled?: (fix: DeviceLocationFix | null) => void;
  timeoutMs?: number;
  goodEnoughAccuracyM?: number;
  enableHighAccuracy?: boolean;
};

/**
 * Short-lived high-accuracy watch. Keeps the lowest `coords.accuracy`
 * and stops when good enough or when the timeout fires.
 */
export function watchBestDeviceLocation(
  options: WatchBestDeviceLocationOptions,
): () => void {
  const timeoutMs = options.timeoutMs ?? GPS_WATCH_TIMEOUT_MS;
  const goodEnoughAccuracyM =
    options.goodEnoughAccuracyM ?? GPS_ACCURACY_GOOD_ENOUGH_M;
  const enableHighAccuracy = options.enableHighAccuracy ?? true;

  let stopped = false;
  let watchId: number | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let minWatchStopId: ReturnType<typeof setTimeout> | null = null;
  let bestFix: DeviceLocationFix | null = null;
  const watchStartedAt = Date.now();

  const stop = (settled = true) => {
    if (stopped) {
      return;
    }
    stopped = true;
    if (watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
    watchId = null;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (minWatchStopId !== null) {
      clearTimeout(minWatchStopId);
      minWatchStopId = null;
    }
    if (settled) {
      options.onSettled?.(bestFix);
    }
  };

  if (typeof window !== "undefined" && window.isSecureContext === false) {
    options.onError("unavailable");
    options.onSettled?.(null);
    return () => {};
  }

  if (!("geolocation" in navigator) || !navigator.geolocation) {
    options.onError("unsupported");
    options.onSettled?.(null);
    return () => {};
  }

  try {
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (stopped) {
          return;
        }
        const fix: DeviceLocationFix = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
          timestamp: position.timestamp ?? Date.now(),
        };

        if (!isBetterGpsFix(fix, bestFix)) {
          return;
        }

        const hadPreviousPublished = bestFix != null && !isStaleGpsFix(bestFix);
        bestFix = fix;

        if (isStaleGpsFix(fix)) {
          return;
        }

        options.onUpdate(fix);

        const goodEnough =
          fix.accuracy != null &&
          Number.isFinite(fix.accuracy) &&
          fix.accuracy <= goodEnoughAccuracyM;
        if (!goodEnough) {
          return;
        }

        const elapsed = Date.now() - watchStartedAt;
        if (hadPreviousPublished || elapsed >= GPS_MIN_WATCH_MS) {
          stop(true);
          return;
        }

        if (minWatchStopId === null) {
          minWatchStopId = setTimeout(() => {
            minWatchStopId = null;
            if (stopped) {
              return;
            }
            if (
              bestFix &&
              !isStaleGpsFix(bestFix) &&
              bestFix.accuracy != null &&
              bestFix.accuracy <= goodEnoughAccuracyM
            ) {
              stop(true);
            }
          }, GPS_MIN_WATCH_MS - elapsed);
        }
      },
      (error) => {
        if (stopped) {
          return;
        }
        if (bestFix && !isStaleGpsFix(bestFix)) {
          stop(true);
          return;
        }
        options.onError(geolocationErrorCodeToReason(error.code));
        stop(true);
      },
      {
        enableHighAccuracy,
        timeout: timeoutMs,
        maximumAge: 0,
      },
    );
  } catch {
    options.onError("unavailable");
    options.onSettled?.(null);
    return () => {};
  }

  timeoutId = setTimeout(() => {
    if (stopped) {
      return;
    }
    if (bestFix && !isStaleGpsFix(bestFix)) {
      stop(true);
      return;
    }
    options.onError("timeout");
    stop(true);
  }, timeoutMs);

  return () => stop(false);
}
