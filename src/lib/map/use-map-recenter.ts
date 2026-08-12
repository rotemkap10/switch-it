import { useCallback, useRef, useState } from "react";

import type { DeviceLocationFix } from "@/lib/map/request-current-device-location";
import {
  peekTrustedSharedForegroundFix,
  waitForTrustedSharedForegroundFix,
} from "@/lib/map/shared-foreground-location";
import { isMateriallyDifferentFix } from "@/lib/map/trusted-foreground-fix";
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
 * Explicit Current Location: use shared trusted fix immediately when available,
 * then optionally refine once from the same shared watch.
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

    try {
      const trusted = peekTrustedSharedForegroundFix();
      if (trusted) {
        onFix?.(trusted);
        const refined = await waitForTrustedSharedForegroundFix(
          "map-recenter-refine",
          {
            timeoutMs: 2_500,
            afterFix: trusted,
          },
        );
        if (sequence !== sequenceRef.current) {
          return;
        }
        if (
          refined.ok &&
          (refined.fix.timestamp > trusted.timestamp ||
            isMateriallyDifferentFix(refined.fix, trusted))
        ) {
          onFix?.(refined.fix);
        }
        return;
      }

      const result = await waitForTrustedSharedForegroundFix("map-recenter", {
        timeoutMs: 12_000,
      });

      if (sequence !== sequenceRef.current) {
        return;
      }

      if (result.ok) {
        onFix?.(result.fix);
        return;
      }

      onError?.(result.reason);
    } finally {
      if (sequence === sequenceRef.current) {
        pendingRef.current = false;
        setPending(false);
      }
    }
  }, [onFix, onError]);

  return { recenter, pending };
}
