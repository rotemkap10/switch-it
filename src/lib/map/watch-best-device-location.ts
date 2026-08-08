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

export function isBetterGpsFix(
  candidate: DeviceLocationFix,
  current: DeviceLocationFix | null,
): boolean {
  if (!current) {
    return true;
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
  let bestFix: DeviceLocationFix | null = null;

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

        bestFix = fix;
        options.onUpdate(fix);

        if (
          fix.accuracy != null &&
          Number.isFinite(fix.accuracy) &&
          fix.accuracy <= goodEnoughAccuracyM
        ) {
          stop(true);
        }
      },
      (error) => {
        if (stopped) {
          return;
        }
        if (bestFix) {
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
    if (bestFix) {
      stop(true);
      return;
    }
    options.onError("timeout");
    stop(true);
  }, timeoutMs);

  return () => stop(false);
}
