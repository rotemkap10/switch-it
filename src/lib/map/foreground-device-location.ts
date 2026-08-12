import { isNativeHandoffPlatform } from "@/lib/location/is-native-handoff-platform";
import type { DeviceLocationFix } from "@/lib/map/request-current-device-location";
import {
  geolocationErrorCodeToReason,
  type GeolocationReason,
} from "@/lib/map/use-user-location";

export type ForegroundLocationProvider = "capacitor" | "browser";

export type ForegroundWatchOptions = {
  enableHighAccuracy?: boolean;
  /** Overall acquisition timeout (ms). */
  timeoutMs?: number;
  /** Reject provider-cached samples older than this (ms). */
  maximumAgeMs?: number;
  /**
   * Android-only desired update interval for Capacitor watchPosition.
   * Keep low during short-lived initial acquisition.
   */
  intervalMs?: number;
  /** Android-only minimum update interval for Capacitor watchPosition. */
  minimumUpdateIntervalMs?: number;
};

export type ForegroundWatchCallbacks = {
  onUpdate: (fix: DeviceLocationFix) => void;
  onError: (reason: GeolocationReason) => void;
};

const DEFAULT_WATCH: Required<ForegroundWatchOptions> = {
  enableHighAccuracy: true,
  timeoutMs: 12_000,
  maximumAgeMs: 0,
  intervalMs: 1_000,
  minimumUpdateIntervalMs: 500,
};

/** Resolved at call time so tests can stub Capacitor / navigator. */
export function resolveForegroundLocationProvider(): ForegroundLocationProvider {
  return isNativeHandoffPlatform() ? "capacitor" : "browser";
}

function toFix(position: {
  coords: { latitude: number; longitude: number; accuracy: number };
  timestamp: number;
}): DeviceLocationFix {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: Number.isFinite(position.coords.accuracy)
      ? position.coords.accuracy
      : null,
    timestamp: position.timestamp ?? Date.now(),
  };
}

function mapCapacitorError(error: unknown): GeolocationReason {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  const lower = message.toLowerCase();
  if (lower.includes("denied") || lower.includes("permission")) {
    return "denied";
  }
  if (lower.includes("timeout")) {
    return "timeout";
  }
  if (lower.includes("unavailable") || lower.includes("disabled")) {
    return "unavailable";
  }
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "number"
  ) {
    return geolocationErrorCodeToReason((error as { code: number }).code);
  }
  return "unavailable";
}

async function ensureCapacitorLocationPermission(): Promise<GeolocationReason | null> {
  const { Geolocation } = await import("@capacitor/geolocation");
  try {
    let status = await Geolocation.checkPermissions();
    if (status.location === "granted" || status.coarseLocation === "granted") {
      return null;
    }
    status = await Geolocation.requestPermissions({
      permissions: ["location", "coarseLocation"],
    });
    if (status.location === "granted" || status.coarseLocation === "granted") {
      return null;
    }
    return "denied";
  } catch (error) {
    return mapCapacitorError(error);
  }
}

/**
 * Short-lived foreground location watch.
 * Native Capacitor Geolocation on iOS/Android; browser geolocation on Web/PWA.
 * Does not touch the background handoff-location plugin.
 */
export function watchForegroundDeviceLocation(
  callbacks: ForegroundWatchCallbacks,
  options: ForegroundWatchOptions = {},
): () => void {
  const opts = { ...DEFAULT_WATCH, ...options };
  let stopped = false;
  let browserWatchId: number | null = null;
  let capacitorWatchId: string | null = null;

  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    if (browserWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(browserWatchId);
      browserWatchId = null;
    }
    if (capacitorWatchId !== null) {
      const id = capacitorWatchId;
      capacitorWatchId = null;
      void import("@capacitor/geolocation")
        .then(({ Geolocation }) => Geolocation.clearWatch({ id }))
        .catch(() => {
          // Best-effort clear.
        });
    }
  };

  const fail = (reason: GeolocationReason) => {
    if (stopped) {
      return;
    }
    callbacks.onError(reason);
    stop();
  };

  void (async () => {
    if (stopped) {
      return;
    }

    if (resolveForegroundLocationProvider() === "capacitor") {
      const permissionError = await ensureCapacitorLocationPermission();
      if (stopped) {
        return;
      }
      if (permissionError) {
        fail(permissionError);
        return;
      }

      try {
        const { Geolocation } = await import("@capacitor/geolocation");
        if (stopped) {
          return;
        }
        capacitorWatchId = await Geolocation.watchPosition(
          {
            enableHighAccuracy: opts.enableHighAccuracy,
            timeout: opts.timeoutMs,
            maximumAge: opts.maximumAgeMs,
            interval: opts.intervalMs,
            minimumUpdateInterval: opts.minimumUpdateIntervalMs,
          },
          (position, error) => {
            if (stopped) {
              return;
            }
            if (error || !position) {
              fail(mapCapacitorError(error ?? "unavailable"));
              return;
            }
            callbacks.onUpdate(toFix(position));
          },
        );
        return;
      } catch {
        // Fall through to browser geolocation if the plugin is unavailable.
        if (stopped) {
          return;
        }
      }
    }

    if (typeof window !== "undefined" && window.isSecureContext === false) {
      fail("unavailable");
      return;
    }
    if (!("geolocation" in navigator) || !navigator.geolocation) {
      fail("unsupported");
      return;
    }

    try {
      browserWatchId = navigator.geolocation.watchPosition(
        (position) => {
          if (stopped) {
            return;
          }
          callbacks.onUpdate(toFix(position));
        },
        (error) => {
          if (stopped) {
            return;
          }
          fail(geolocationErrorCodeToReason(error.code));
        },
        {
          enableHighAccuracy: opts.enableHighAccuracy,
          timeout: opts.timeoutMs,
          maximumAge: opts.maximumAgeMs,
        },
      );
    } catch {
      fail("unavailable");
    }
  })();

  return () => {
    stop();
  };
}

/**
 * One-shot foreground location (explicit Current Location / recenter).
 */
export async function getForegroundDeviceLocation(
  options: ForegroundWatchOptions = {},
): Promise<
  | { ok: true; fix: DeviceLocationFix; provider: ForegroundLocationProvider }
  | {
      ok: false;
      reason: GeolocationReason;
      provider: ForegroundLocationProvider;
    }
> {
  const opts = { ...DEFAULT_WATCH, ...options };
  const provider = resolveForegroundLocationProvider();

  if (provider === "capacitor") {
    const permissionError = await ensureCapacitorLocationPermission();
    if (permissionError) {
      return { ok: false, reason: permissionError, provider };
    }
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: opts.enableHighAccuracy,
        timeout: opts.timeoutMs,
        maximumAge: opts.maximumAgeMs,
      });
      return { ok: true, fix: toFix(position), provider };
    } catch {
      // Fall through to browser.
    }
  }

  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return { ok: false, reason: "unavailable", provider: "browser" };
  }
  if (!("geolocation" in navigator) || !navigator.geolocation) {
    return { ok: false, reason: "unsupported", provider: "browser" };
  }

  return new Promise((resolve) => {
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            ok: true,
            fix: toFix(position),
            provider: "browser",
          });
        },
        (error) => {
          resolve({
            ok: false,
            reason: geolocationErrorCodeToReason(error.code),
            provider: "browser",
          });
        },
        {
          enableHighAccuracy: opts.enableHighAccuracy,
          timeout: opts.timeoutMs,
          maximumAge: opts.maximumAgeMs,
        },
      );
    } catch (err: unknown) {
      const maybe = err as { name?: unknown; code?: unknown };
      const reason =
        typeof maybe.code === "number"
          ? geolocationErrorCodeToReason(maybe.code)
          : typeof maybe.name === "string" &&
              maybe.name.toLowerCase().includes("denied")
            ? "denied"
            : "unavailable";
      resolve({ ok: false, reason, provider: "browser" });
    }
  });
}
