import { getForegroundDeviceLocation } from "@/lib/map/foreground-device-location";
import type { GeolocationReason } from "@/lib/map/use-user-location";

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
 * Native Capacitor Geolocation on iOS/Android; browser on Web/PWA.
 * Does not start a long-lived watch and does not use background handoff GPS.
 */
export async function requestCurrentDeviceLocation(
  options: RequestCurrentDeviceLocationOptions = {},
): Promise<DeviceLocationResult> {
  const { enableHighAccuracy, timeoutMs, maximumAgeMs } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const result = await getForegroundDeviceLocation({
    enableHighAccuracy,
    timeoutMs,
    maximumAgeMs,
  });

  if (result.ok) {
    return { ok: true, fix: result.fix };
  }
  return { ok: false, reason: result.reason };
}
