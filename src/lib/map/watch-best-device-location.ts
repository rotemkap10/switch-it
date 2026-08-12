import { haversineDistanceMeters } from "@/lib/map/distance";
import { watchForegroundDeviceLocation } from "@/lib/map/foreground-device-location";
import type { DeviceLocationFix } from "@/lib/map/request-current-device-location";
import type { GeolocationReason } from "@/lib/map/use-user-location";

/** Publisher-facing accuracy bands (meters). */
export const GPS_ACCURACY_GOOD_MAX_M = 15;
export const GPS_ACCURACY_ACCEPTABLE_MAX_M = 30;
/** Stop watching early once a fix is this good or better (and fresh). */
export const GPS_ACCURACY_GOOD_ENOUGH_M = 10;
/** Wall-clock cap for watchPosition during publish / Find Parking init. */
export const GPS_WATCH_TIMEOUT_MS = 12_000;
/**
 * Samples older than this are clearly cached and must not be published as
 * the current parking / map location. Android WebView and Fused Location
 * often deliver last-known fixes first.
 */
export const GPS_STALE_FIX_MAX_AGE_MS = 15_000;
/**
 * A fix must be at least this fresh before we allow an early watch stop.
 * Prevents locking onto a high-accuracy last-known sample that Android
 * re-stamped near "now" but is still geographically stale.
 */
export const GPS_FRESH_FIX_MAX_AGE_MS = 5_000;
/**
 * Keep listening briefly after the first usable update so a fresher sample
 * can replace a provisional / cached one. Do not wait this long if a
 * genuinely fresh good fix already arrived after a prior provisional.
 */
export const GPS_MIN_WATCH_MS = 2_500;
/** A later sample this far away is a new place, not GPS jitter. */
export const GPS_MOVED_SIGNIFICANTLY_M = 50;
/**
 * Prefer a meaningfully newer sample over a slightly more accurate older
 * one when the user has moved (freshness > tiny accuracy wins).
 */
export const GPS_NEWER_SAMPLE_MIN_MS = 1_000;

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

export function gpsFixAgeMs(fix: DeviceLocationFix, now = Date.now()): number {
  if (!Number.isFinite(fix.timestamp) || fix.timestamp <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, now - fix.timestamp);
}

export function isStaleGpsFix(
  fix: DeviceLocationFix,
  now = Date.now(),
): boolean {
  if (!Number.isFinite(fix.timestamp) || fix.timestamp <= 0) {
    return false;
  }
  return gpsFixAgeMs(fix, now) > GPS_STALE_FIX_MAX_AGE_MS;
}

/** Fresh enough to allow early watch termination. */
export function isFreshEnoughToStop(
  fix: DeviceLocationFix,
  now = Date.now(),
): boolean {
  if (isStaleGpsFix(fix, now)) {
    return false;
  }
  return gpsFixAgeMs(fix, now) <= GPS_FRESH_FIX_MAX_AGE_MS;
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
  const candidateAge = gpsFixAgeMs(candidate, now);
  const currentAge = gpsFixAgeMs(current, now);

  // Fresher sample at a new place beats an older high-accuracy cache, even
  // when reported accuracy is slightly worse (e.g. 16m now vs 8m Herzliya).
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

  // Same place / small move: prefer a clearly fresher sample over a slightly
  // more accurate older one (Android last-known vs live GPS).
  if (
    !candidateStale &&
    newerBy >= GPS_NEWER_SAMPLE_MIN_MS &&
    candidateAge + GPS_NEWER_SAMPLE_MIN_MS < currentAge
  ) {
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
 * Short-lived high-accuracy foreground watch.
 * Uses Capacitor Geolocation on native Android/iOS and browser geolocation
 * on Web/PWA. Keeps improving until a fresh good-enough fix arrives or timeout.
 */
export function watchBestDeviceLocation(
  options: WatchBestDeviceLocationOptions,
): () => void {
  const timeoutMs = options.timeoutMs ?? GPS_WATCH_TIMEOUT_MS;
  const goodEnoughAccuracyM =
    options.goodEnoughAccuracyM ?? GPS_ACCURACY_GOOD_ENOUGH_M;
  const enableHighAccuracy = options.enableHighAccuracy ?? true;

  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let minWatchStopId: ReturnType<typeof setTimeout> | null = null;
  let bestFix: DeviceLocationFix | null = null;
  let publishedCount = 0;
  let stopProvider: () => void = () => {};
  const watchStartedAt = Date.now();

  const stop = (settled = true) => {
    if (stopped) {
      return;
    }
    stopped = true;
    stopProvider();
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

  stopProvider = watchForegroundDeviceLocation(
    {
      onUpdate: (fix) => {
        if (stopped) {
          return;
        }

        if (!isBetterGpsFix(fix, bestFix)) {
          return;
        }

        const hadPreviousPublished =
          bestFix != null && !isStaleGpsFix(bestFix);
        bestFix = fix;

        // Clearly stale samples are never published as current location.
        if (isStaleGpsFix(fix)) {
          return;
        }

        publishedCount += 1;
        options.onUpdate(fix);

        const goodEnough =
          fix.accuracy != null &&
          Number.isFinite(fix.accuracy) &&
          fix.accuracy <= goodEnoughAccuracyM;

        // Never stop solely because the first cached/high-accuracy sample
        // looked good — require freshness + a short replace window.
        if (!goodEnough || !isFreshEnoughToStop(fix)) {
          return;
        }

        const elapsed = Date.now() - watchStartedAt;
        const canStopEarly =
          publishedCount >= 2 ||
          hadPreviousPublished ||
          elapsed >= GPS_MIN_WATCH_MS;

        if (canStopEarly) {
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
              isFreshEnoughToStop(bestFix) &&
              bestFix.accuracy != null &&
              bestFix.accuracy <= goodEnoughAccuracyM
            ) {
              stop(true);
            }
          }, GPS_MIN_WATCH_MS - elapsed);
        }
      },
      onError: (reason) => {
        if (stopped) {
          return;
        }
        if (bestFix && !isStaleGpsFix(bestFix)) {
          stop(true);
          return;
        }
        options.onError(reason);
        stop(true);
      },
    },
    {
      enableHighAccuracy,
      timeoutMs,
      maximumAgeMs: 0,
      intervalMs: 1_000,
      minimumUpdateIntervalMs: 500,
    },
  );

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
