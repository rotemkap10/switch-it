import { isNativeHandoffPlatform } from "@/lib/location/is-native-handoff-platform";
import {
  resolveForegroundLocationProvider,
  watchForegroundDeviceLocation,
  type ForegroundLocationProvider,
  type ForegroundWatchOptions,
} from "@/lib/map/foreground-device-location";
import { logForegroundLocationDiag } from "@/lib/map/foreground-location-diagnostics";
import type { DeviceLocationFix } from "@/lib/map/request-current-device-location";
import {
  evaluateTrustedCurrentFix,
  isMateriallyDifferentFix,
  isPreferredForegroundFix,
  isTrustedCurrentFix,
  TRUSTED_FIX_MAX_AGE_MS,
  type TrackedForegroundFix,
} from "@/lib/map/trusted-foreground-fix";
import type { GeolocationReason } from "@/lib/map/use-user-location";

/** Keep the native watch briefly so Find → Share does not cold-start GPS. */
export const SHARED_FOREGROUND_RELEASE_GRACE_MS = 1_500;

/** Android Capacitor watch tuning for responsive map surfaces. */
export const ANDROID_FOREGROUND_WATCH_OPTIONS: Required<ForegroundWatchOptions> =
  {
    enableHighAccuracy: true,
    timeoutMs: 15_000,
    maximumAgeMs: 0,
    intervalMs: 1_000,
    minimumUpdateIntervalMs: 500,
  };

export const DEFAULT_FOREGROUND_WATCH_OPTIONS: Required<ForegroundWatchOptions> =
  {
    enableHighAccuracy: true,
    timeoutMs: 12_000,
    maximumAgeMs: 0,
    intervalMs: 1_000,
    minimumUpdateIntervalMs: 500,
  };

export type SharedForegroundLocationSnapshot = {
  sessionStartedAt: number | null;
  trustedFix: DeviceLocationFix | null;
  /** Latest sample kept for diagnostics; never use for publish/camera by itself. */
  provisionalFix: DeviceLocationFix | null;
  status: "idle" | "acquiring" | "ready" | "error";
  error: GeolocationReason | null;
  provider: ForegroundLocationProvider | null;
  activeConsumerCount: number;
  watchActive: boolean;
  timeToFirstTrustedMs: number | null;
};

type Listener = (snapshot: SharedForegroundLocationSnapshot) => void;

const consumers = new Set<string>();
const listeners = new Set<Listener>();

let stopWatch: (() => void) | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;
let sessionStartedAt: number | null = null;
let trustedTracked: TrackedForegroundFix | null = null;
let provisionalTracked: TrackedForegroundFix | null = null;
let status: SharedForegroundLocationSnapshot["status"] = "idle";
let error: GeolocationReason | null = null;
let provider: ForegroundLocationProvider | null = null;
let firstTrustedAt: number | null = null;
let isAndroidSession = false;
let visibilityBound = false;

function getCapacitorPlatform(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const capacitor = (
    window as unknown as {
      Capacitor?: { getPlatform?: () => string };
    }
  ).Capacitor;
  try {
    return capacitor?.getPlatform?.() ?? null;
  } catch {
    return null;
  }
}

export function isNativeAndroidForegroundPlatform(): boolean {
  return isNativeHandoffPlatform() && getCapacitorPlatform() === "android";
}

function snapshot(): SharedForegroundLocationSnapshot {
  return {
    sessionStartedAt,
    trustedFix: trustedTracked
      ? {
          latitude: trustedTracked.latitude,
          longitude: trustedTracked.longitude,
          accuracy: trustedTracked.accuracy,
          timestamp: trustedTracked.timestamp,
        }
      : null,
    provisionalFix: provisionalTracked
      ? {
          latitude: provisionalTracked.latitude,
          longitude: provisionalTracked.longitude,
          accuracy: provisionalTracked.accuracy,
          timestamp: provisionalTracked.timestamp,
        }
      : null,
    status,
    error,
    provider,
    activeConsumerCount: consumers.size,
    watchActive: stopWatch != null,
    timeToFirstTrustedMs:
      firstTrustedAt != null && sessionStartedAt != null
        ? Math.max(0, firstTrustedAt - sessionStartedAt)
        : null,
  };
}

function emit() {
  const snap = snapshot();
  for (const listener of listeners) {
    listener(snap);
  }
}

function clearReleaseTimer() {
  if (releaseTimer != null) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
}

function stopWatchInternal(resetSession: boolean) {
  stopWatch?.();
  stopWatch = null;
  if (resetSession) {
    sessionStartedAt = null;
    trustedTracked = null;
    provisionalTracked = null;
    status = "idle";
    error = null;
    provider = null;
    firstTrustedAt = null;
    isAndroidSession = false;
  }
}

function handleWatchUpdate(fix: DeviceLocationFix) {
  if (sessionStartedAt == null) {
    return;
  }
  const now = Date.now();
  const tracked: TrackedForegroundFix = { ...fix, receivedAt: now };
  const decision = evaluateTrustedCurrentFix(fix, sessionStartedAt, now, {
    isAndroid: isAndroidSession,
    receivedAt: now,
    allowInstantFirstSample: false,
  });

  logForegroundLocationDiag({
    provider,
    sessionStartedAt,
    callbackAt: now,
    positionTimestamp: fix.timestamp,
    ageMs: Math.max(0, now - fix.timestamp),
    accuracyM: fix.accuracy,
    latitude: fix.latitude,
    longitude: fix.longitude,
    accepted: decision.trusted,
    rejectionReason: decision.trusted ? undefined : decision.reason,
    timeToFirstTrustedMs:
      firstTrustedAt != null ? firstTrustedAt - sessionStartedAt : null,
  });

  if (!decision.trusted) {
    provisionalTracked = tracked;
    // Keep acquiring — never promote untrusted samples to camera/publish.
    if (status !== "ready") {
      status = "acquiring";
    }
    emit();
    return;
  }

  if (
    !isPreferredForegroundFix(tracked, trustedTracked, sessionStartedAt, now, {
      isAndroid: isAndroidSession,
    }) &&
    trustedTracked
  ) {
    emit();
    return;
  }

  trustedTracked = tracked;
  provisionalTracked = tracked;
  if (firstTrustedAt == null) {
    firstTrustedAt = now;
    logForegroundLocationDiag({
      provider,
      sessionStartedAt,
      accepted: true,
      timeToFirstTrustedMs: now - sessionStartedAt,
      note: "first_trusted_fix",
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracyM: fix.accuracy,
      ageMs: Math.max(0, now - fix.timestamp),
      positionTimestamp: fix.timestamp,
      callbackAt: now,
    });
  }
  status = "ready";
  error = null;
  emit();
}

function handleWatchError(reason: GeolocationReason) {
  stopWatch = null;
  const now = Date.now();
  if (
    trustedTracked &&
    sessionStartedAt != null &&
    isTrustedCurrentFix(trustedTracked, sessionStartedAt, now, {
      isAndroid: isAndroidSession,
      receivedAt: trustedTracked.receivedAt,
      allowInstantFirstSample: true,
    })
  ) {
    status = "ready";
    error = null;
    emit();
    if (consumers.size > 0) {
      window.setTimeout(() => {
        if (consumers.size > 0 && !stopWatch) {
          startWatch();
        }
      }, 1_000);
    }
    return;
  }
  error = reason;
  status = "error";
  emit();
}

function watchOptionsForSession(): Required<ForegroundWatchOptions> {
  return isAndroidSession
    ? ANDROID_FOREGROUND_WATCH_OPTIONS
    : DEFAULT_FOREGROUND_WATCH_OPTIONS;
}

function startWatch() {
  if (stopWatch || consumers.size === 0) {
    return;
  }
  isAndroidSession = isNativeAndroidForegroundPlatform();
  const isNewSession = sessionStartedAt == null;
  if (isNewSession) {
    sessionStartedAt = Date.now();
    trustedTracked = null;
    provisionalTracked = null;
    firstTrustedAt = null;
  }
  provider = resolveForegroundLocationProvider();
  status = trustedTracked ? "ready" : "acquiring";
  error = null;
  emit();

  stopWatch = watchForegroundDeviceLocation(
    {
      onUpdate: handleWatchUpdate,
      onError: handleWatchError,
    },
    watchOptionsForSession(),
  );
}

function ensureWatchRunning() {
  clearReleaseTimer();
  if (!stopWatch) {
    startWatch();
  } else {
    emit();
  }
}

function scheduleReleaseIfEmpty() {
  if (consumers.size > 0) {
    return;
  }
  clearReleaseTimer();
  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    if (consumers.size > 0) {
      return;
    }
    stopWatchInternal(true);
    emit();
  }, SHARED_FOREGROUND_RELEASE_GRACE_MS);
}

function ensureVisibilityHandling() {
  if (typeof document === "undefined" || visibilityBound) {
    return;
  }
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      stopWatch?.();
      stopWatch = null;
      emit();
      return;
    }
    if (consumers.size > 0) {
      startWatch();
    }
  });
}

/**
 * Ref-counted shared foreground GPS session for map surfaces.
 * One Capacitor/browser watch while any consumer is active.
 */
export function acquireSharedForegroundLocation(consumerId: string): () => void {
  ensureVisibilityHandling();
  consumers.add(consumerId);
  ensureWatchRunning();
  return () => {
    consumers.delete(consumerId);
    scheduleReleaseIfEmpty();
    emit();
  };
}

export function subscribeSharedForegroundLocation(listener: Listener): () => void {
  listeners.add(listener);
  listener(snapshot());
  return () => {
    listeners.delete(listener);
  };
}

export function getSharedForegroundLocationSnapshot(): SharedForegroundLocationSnapshot {
  return snapshot();
}

/**
 * Latest trusted fix still within the freshness window, or null.
 */
export function peekTrustedSharedForegroundFix(
  now = Date.now(),
): DeviceLocationFix | null {
  if (!trustedTracked || sessionStartedAt == null) {
    return null;
  }
  if (
    !isTrustedCurrentFix(trustedTracked, sessionStartedAt, now, {
      isAndroid: isAndroidSession,
      receivedAt: trustedTracked.receivedAt,
      allowInstantFirstSample: true,
    })
  ) {
    return null;
  }
  return {
    latitude: trustedTracked.latitude,
    longitude: trustedTracked.longitude,
    accuracy: trustedTracked.accuracy,
    timestamp: trustedTracked.timestamp,
  };
}

export type WaitForTrustedFixOptions = {
  timeoutMs?: number;
  /** If set, wait until a materially different / newer trusted fix arrives. */
  afterFix?: DeviceLocationFix | null;
};

/**
 * Wait for the next trusted shared fix (or timeout).
 * Ensures a consumer is holding the session for the duration of the wait.
 */
export function waitForTrustedSharedForegroundFix(
  consumerId: string,
  options: WaitForTrustedFixOptions = {},
): Promise<
  | { ok: true; fix: DeviceLocationFix }
  | { ok: false; reason: GeolocationReason }
> {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const afterFix = options.afterFix ?? null;
  const release = acquireSharedForegroundLocation(consumerId);

  return new Promise((resolve) => {
    let settled = false;
    let unsub: () => void = () => {};
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = (
      result:
        | { ok: true; fix: DeviceLocationFix }
        | { ok: false; reason: GeolocationReason },
    ) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId != null) {
        clearTimeout(timeoutId);
      }
      unsub();
      release();
      resolve(result);
    };

    const consider = (fix: DeviceLocationFix | null) => {
      if (!fix) {
        return;
      }
      if (afterFix) {
        const newer = fix.timestamp > afterFix.timestamp;
        const moved = isMateriallyDifferentFix(fix, afterFix);
        if (!newer && !moved) {
          return;
        }
      }
      finish({ ok: true, fix });
    };

    unsub = subscribeSharedForegroundLocation((snap) => {
      if (snap.status === "error" && snap.error && !snap.trustedFix) {
        finish({ ok: false, reason: snap.error });
        return;
      }
      consider(snap.trustedFix);
    });

    const immediate = peekTrustedSharedForegroundFix();
    consider(immediate);

    if (!settled) {
      timeoutId = setTimeout(() => {
        const late = peekTrustedSharedForegroundFix();
        if (late) {
          finish({ ok: true, fix: late });
          return;
        }
        finish({ ok: false, reason: "timeout" });
      }, timeoutMs);
    }
  });
}

export function resetSharedForegroundLocationForTests(): void {
  clearReleaseTimer();
  consumers.clear();
  listeners.clear();
  stopWatchInternal(true);
  visibilityBound = false;
}

export { TRUSTED_FIX_MAX_AGE_MS };
