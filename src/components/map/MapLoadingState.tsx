"use client";

import { useEffect, useState } from "react";

import {
  BrandedLoadingState,
  MAP_READY_FADE_MS,
  MAP_SLOW_NETWORK_HINT_MS,
} from "@/components/brand/BrandedLoadingState";

export { MAP_READY_FADE_MS, MAP_SLOW_NETWORK_HINT_MS };

type MapLoadingStateProps = {
  className?: string;
  /** Test override; otherwise uses prefers-reduced-motion. */
  reducedMotion?: boolean;
};

/**
 * Embedded map-area loader — thin wrapper around the shared parking-pin visual.
 */
export function MapLoadingState({
  className = "",
  reducedMotion,
}: MapLoadingStateProps) {
  const [showSlowHint, setShowSlowHint] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setShowSlowHint(true);
    }, MAP_SLOW_NETWORK_HINT_MS);

    return () => window.clearTimeout(id);
  }, []);

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
