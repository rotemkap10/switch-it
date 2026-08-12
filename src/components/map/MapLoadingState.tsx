"use client";

import { useEffect, useState } from "react";

import {
  BrandedLoadingState,
  MAP_READY_FADE_MS,
  MAP_SLOW_NETWORK_HINT_MS,
} from "@/components/brand/BrandedLoadingState";
import { useAppLaunchReady } from "@/components/shell/AppLaunchReadyContext";

export { MAP_READY_FADE_MS, MAP_SLOW_NETWORK_HINT_MS };

type MapLoadingStateProps = {
  className?: string;
  /** Test override; otherwise uses prefers-reduced-motion. */
  reducedMotion?: boolean;
};

/**
 * Embedded map-area loader — thin wrapper around the shared driving-car visual.
 * Suppressed while the cold-launch splash owns the loading surface.
 */
export function MapLoadingState({
  className = "",
  reducedMotion,
}: MapLoadingStateProps) {
  const launchReady = useAppLaunchReady();
  const [showSlowHint, setShowSlowHint] = useState(false);

  useEffect(() => {
    if (!launchReady) {
      return;
    }
    const id = window.setTimeout(() => {
      setShowSlowHint(true);
    }, MAP_SLOW_NETWORK_HINT_MS);

    return () => window.clearTimeout(id);
  }, [launchReady]);

  if (!launchReady) {
    return (
      <div
        className={["h-full w-full bg-transparent", className].join(" ")}
        data-testid="map-loading-suppressed-by-launch"
        aria-hidden="true"
      />
    );
  }

  return (
    <BrandedLoadingState
      label="Loading the map…"
      supportingText={
        showSlowHint
          ? "This may take a moment on a slow connection."
          : null
      }
      variant="compact"
      className={className}
      ariaLabel="Loading map"
      reducedMotion={reducedMotion}
    />
  );
}
