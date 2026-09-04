"use client";

import { useEffect } from "react";

import { useMode } from "@/components/mode/ModeProvider";
import { scheduleIdle } from "@/lib/navigation/core-route-prefetch";

/**
 * Idle-time MapLibre module preload + worker prewarm for authenticated users.
 * Does not run on login/register. Does not create a Map instance.
 */
export function MapLibreWarmup() {
  const { ready } = useMode();

  useEffect(() => {
    if (!ready) {
      return;
    }

    return scheduleIdle(() => {
      void import("@/lib/map/prewarm-maplibre")
        .then((mod) => mod.prewarmMapLibre())
        .catch(() => {
          // Non-blocking — first Map create still loads MapLibre.
        });
    });
  }, [ready]);

  return null;
}
