"use client";

import { Card } from "@/components/ui/Card";

export type MapUnavailableReason = "configuration" | "temporary";

type MapUnavailableProps = {
  reason?: MapUnavailableReason;
  onRetry?: () => void;
};

/**
 * Fatal map fallback. Prefer "temporary" + retry for runtime failures.
 * "configuration" is for a missing/invalid client MapTiler key at build time.
 */
export function MapUnavailable({
  reason = "temporary",
  onRetry,
}: MapUnavailableProps) {
  const isConfig = reason === "configuration";

  return (
    <Card className="mx-auto max-w-lg" data-testid="map-unavailable">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-foreground">
            {isConfig
              ? "Map is unavailable"
              : "Map is temporarily unavailable"}
          </p>
          <p className="text-sm text-muted">
            {isConfig
              ? "We couldn’t load the map tiles. Please check your configuration and try again."
              : "We couldn’t load the map right now. Check your connection and try again."}
          </p>
        </div>
        {onRetry && !isConfig ? (
          <button
            type="button"
            className="motion-interactive-press min-h-[var(--app-tap-min)] w-full rounded-xl bg-accent px-3 text-sm font-semibold text-surface sm:w-auto sm:self-start"
            onClick={onRetry}
            data-testid="map-unavailable-retry"
          >
            Try again
          </button>
        ) : null}
      </div>
    </Card>
  );
}
