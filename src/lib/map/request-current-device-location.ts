import { geolocationErrorCodeToReason, type GeolocationReason } from "@/lib/map/use-user-location";

export type DeviceLocationFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

export type DeviceLocationResult =
  | { ok: true; fix: DeviceLocationFix }
  | { ok: false; reason: GeolocationReason };

export type RequestCurrentDeviceLocationOptions = {
  enableHighAccuracy?: boolean;
  timeoutMs?: number;
  maximumAgeMs?: number;
};

const DEFAULT_OPTIONS: Required<RequestCurrentDeviceLocationOptions> = {
  enableHighAccuracy: true,
  timeoutMs: 10_000,
  maximumAgeMs: 0,
};

/**
 * One-shot device location for explicit recenter actions.
 * Does not start watchPosition.
 */
export function requestCurrentDeviceLocation(
  options: RequestCurrentDeviceLocationOptions = {},
): Promise<DeviceLocationResult> {
  const { enableHighAccuracy, timeoutMs, maximumAgeMs } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return Promise.resolve({ ok: false, reason: "unavailable" });
  }

  if (!("geolocation" in navigator) || !navigator.geolocation) {
    return Promise.resolve({ ok: false, reason: "unsupported" });
  }

  return new Promise((resolve) => {
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            ok: true,
            fix: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp ?? Date.now(),
            },
          });
        },
        (error) => {
          resolve({
            ok: false,
            reason: geolocationErrorCodeToReason(error.code),
          });
        },
        { enableHighAccuracy, timeout: timeoutMs, maximumAge: maximumAgeMs },
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
      resolve({ ok: false, reason });
    }
  });
}
