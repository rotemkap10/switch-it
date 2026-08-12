import {
  peekTrustedSharedForegroundFix,
  waitForTrustedSharedForegroundFix,
} from "@/lib/map/shared-foreground-location";
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
 * Prefer the shared foreground session's trusted fix (immediate on Android when
 * Find Parking / Share already warmed GPS). Falls back to waiting on that same
 * shared watch — avoids competing one-shot getCurrentPosition cold starts.
 */
export async function requestCurrentDeviceLocation(
  options: RequestCurrentDeviceLocationOptions = {},
): Promise<DeviceLocationResult> {
  const { timeoutMs } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const trusted = peekTrustedSharedForegroundFix();
  if (trusted) {
    return { ok: true, fix: trusted };
  }

  return waitForTrustedSharedForegroundFix("request-current-location", {
    timeoutMs,
  });
}
