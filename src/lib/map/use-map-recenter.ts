import { useCallback, useRef, useState } from "react";

import {
  requestCurrentDeviceLocation,
  type DeviceLocationFix,
} from "@/lib/map/request-current-device-location";
import type { GeolocationReason } from "@/lib/map/use-user-location";

export const MAP_RECENTER_UNAVAILABLE_MESSAGE =
  "Current location is unavailable.";
export const MAP_RECENTER_UNAVAILABLE_HINT =
  "You can still move the map manually.";

type UseMapRecenterOptions = {
  onFix?: (fix: DeviceLocationFix) => void;
  onError?: (reason: GeolocationReason) => void;
};

/**
 * One-shot recenter: fresh geolocation per click, no watchPosition.
 * Ignores stale results when a newer request is in flight.
 */
export function useMapRecenter(options: UseMapRecenterOptions = {}) {
  const { onFix, onError } = options;
  const [pending, setPending] = useState(false);
  const sequenceRef = useRef(0);
  const pendingRef = useRef(false);

  const recenter = useCallback(async () => {
    if (pendingRef.current) {
      return;
    }

    const sequence = sequenceRef.current + 1;
    sequenceRef.current = sequence;
    pendingRef.current = true;
    setPending(true);

    const result = await requestCurrentDeviceLocation({
      enableHighAccuracy: true,
      maximumAgeMs: 0,
    });

    if (sequence !== sequenceRef.current) {
      return;
    }

    pendingRef.current = false;
    setPending(false);

    if (result.ok) {
      onFix?.(result.fix);
      return;
    }

    onError?.(result.reason);
  }, [onFix, onError]);

  return { recenter, pending };
}
