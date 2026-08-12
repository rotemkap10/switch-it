import { isValidLatLng } from "@/lib/map/distance";
import type { DeviceLocationFix } from "@/lib/map/request-current-device-location";
import { haversineDistanceMeters } from "@/lib/map/distance";

/**
 * Authoritative initial / shared-store fixes must be this fresh.
 * Older samples (even with excellent reported accuracy) stay provisional.
 */
export const TRUSTED_FIX_MAX_AGE_MS = 5_000;

/**
 * Position timestamps slightly before session start can still be live GPS
 * (clock skew / provider lag). Beyond this → treat as pre-session cache.
 */
export const SESSION_FIX_TOLERANCE_MS = 1_500;

/**
 * On Android, Fused Location often delivers last-known instantly.
 * A sample received this soon after watch start is treated as provisional.
 */
export const ANDROID_INSTANT_CACHE_SUSPECT_MS = 450;

/** Later sample this far away is a different place, not jitter. */
export const TRUSTED_FIX_MOVED_M = 40;

export type TrustedFixDecision = {
  trusted: boolean;
  reason:
    | "ok"
    | "invalid_coords"
    | "invalid_timestamp"
    | "too_old"
    | "pre_session_cache"
    | "android_instant_cache_suspect";
};

export type TrackedForegroundFix = DeviceLocationFix & {
  /** Wall-clock when this callback was received. */
  receivedAt: number;
};

export function evaluateTrustedCurrentFix(
  fix: DeviceLocationFix,
  sessionStartedAt: number,
  now = Date.now(),
  options: {
    isAndroid?: boolean;
    receivedAt?: number;
    allowInstantFirstSample?: boolean;
  } = {},
): TrustedFixDecision {
  if (
    !isValidLatLng({
      latitude: fix.latitude,
      longitude: fix.longitude,
    })
  ) {
    return { trusted: false, reason: "invalid_coords" };
  }
  if (!Number.isFinite(fix.timestamp) || fix.timestamp <= 0) {
    return { trusted: false, reason: "invalid_timestamp" };
  }

  const age = Math.max(0, now - fix.timestamp);
  if (age > TRUSTED_FIX_MAX_AGE_MS) {
    return { trusted: false, reason: "too_old" };
  }

  if (fix.timestamp < sessionStartedAt - SESSION_FIX_TOLERANCE_MS) {
    return { trusted: false, reason: "pre_session_cache" };
  }

  const receivedAt = options.receivedAt ?? now;
  if (
    options.isAndroid &&
    !options.allowInstantFirstSample &&
    receivedAt - sessionStartedAt <= ANDROID_INSTANT_CACHE_SUSPECT_MS
  ) {
    return { trusted: false, reason: "android_instant_cache_suspect" };
  }

  return { trusted: true, reason: "ok" };
}

export function isTrustedCurrentFix(
  fix: DeviceLocationFix,
  sessionStartedAt: number,
  now = Date.now(),
  options?: Parameters<typeof evaluateTrustedCurrentFix>[3],
): boolean {
  return evaluateTrustedCurrentFix(fix, sessionStartedAt, now, options).trusted;
}

/**
 * Freshness / session continuity first, then reported accuracy.
 * Never prefer an old high-accuracy cache over a fresh lower-accuracy fix.
 */
export function isPreferredForegroundFix(
  candidate: TrackedForegroundFix,
  current: TrackedForegroundFix | null,
  sessionStartedAt: number,
  now = Date.now(),
  options: { isAndroid?: boolean } = {},
): boolean {
  const candidateTrust = evaluateTrustedCurrentFix(
    candidate,
    sessionStartedAt,
    now,
    {
      isAndroid: options.isAndroid,
      receivedAt: candidate.receivedAt,
      allowInstantFirstSample: true,
    },
  );
  if (!candidateTrust.trusted && candidateTrust.reason !== "android_instant_cache_suspect") {
    // Untrusted (too old / pre-session) never wins as preferred store tip.
    if (
      candidateTrust.reason === "too_old" ||
      candidateTrust.reason === "pre_session_cache" ||
      candidateTrust.reason === "invalid_coords" ||
      candidateTrust.reason === "invalid_timestamp"
    ) {
      return false;
    }
  }

  if (!current) {
    return true;
  }

  const currentAge = Math.max(0, now - current.timestamp);
  const candidateAge = Math.max(0, now - candidate.timestamp);
  const currentTrusted = isTrustedCurrentFix(current, sessionStartedAt, now, {
    isAndroid: options.isAndroid,
    receivedAt: current.receivedAt,
    allowInstantFirstSample: true,
  });
  const candidateTrusted = candidateTrust.trusted ||
    candidateTrust.reason === "android_instant_cache_suspect";

  if (candidateTrusted && !currentTrusted) {
    return true;
  }
  if (!candidateTrusted && currentTrusted) {
    return false;
  }

  const moved =
    haversineDistanceMeters(
      { latitude: candidate.latitude, longitude: candidate.longitude },
      { latitude: current.latitude, longitude: current.longitude },
    ) >= TRUSTED_FIX_MOVED_M;

  // Newer sample (by provider timestamp or receive order) wins when fresher.
  if (candidate.timestamp > current.timestamp + 250) {
    if (moved || candidateAge + 500 < currentAge) {
      return true;
    }
  }
  if (candidate.receivedAt > current.receivedAt + 250 && moved) {
    return true;
  }

  // Same place: only then prefer better accuracy among similarly fresh samples.
  const next = candidate.accuracy;
  const prev = current.accuracy;
  if (
    next != null &&
    Number.isFinite(next) &&
    (prev == null || !Number.isFinite(prev) || next < prev - 0.5) &&
    candidateAge <= currentAge + 1_000
  ) {
    return true;
  }

  return false;
}

export function isMateriallyDifferentFix(
  next: DeviceLocationFix,
  prev: DeviceLocationFix,
  meters = TRUSTED_FIX_MOVED_M,
): boolean {
  return (
    haversineDistanceMeters(
      { latitude: next.latitude, longitude: next.longitude },
      { latitude: prev.latitude, longitude: prev.longitude },
    ) >= meters
  );
}
