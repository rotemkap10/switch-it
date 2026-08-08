"use client";

import type { SeekerShareUiState } from "@/lib/location/use-seeker-live-location-share";

type SeekerShareLocationCardProps = {
  uiState: SeekerShareUiState;
  resumedOnce?: boolean;
  onShare?: () => void;
  onStop: () => void;
};

/**
 * Compact live-location status. Sharing starts from navigation provider tap,
 * not a separate consent card.
 */
export function SeekerShareLocationCard({
  uiState,
  onStop,
}: SeekerShareLocationCardProps) {
  if (uiState === "idle" || uiState === "prompt") {
    return null;
  }

  const label =
    uiState === "acquiring"
      ? "Getting an accurate location…"
      : uiState === "weak"
        ? "Location signal is weak"
        : uiState === "sharing"
          ? "Live location on"
          : uiState === "paused"
            ? "Live location paused"
            : uiState === "denied" || uiState === "unavailable" || uiState === "off"
              ? "Live location off"
              : null;
  if (!label) {
    return null;
  }

  const canStop =
    uiState === "acquiring" ||
    uiState === "weak" ||
    uiState === "sharing" ||
    uiState === "paused";

  return (
    <div
      className="flex items-center justify-between gap-3"
      data-testid="seeker-share-location"
      data-state={uiState === "off" ? "off" : uiState}
      aria-live="polite"
    >
      <p className="text-xs font-medium text-muted">{label}</p>
      {canStop ? (
        <button
          type="button"
          className="motion-interactive-press shrink-0 text-xs font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
          onClick={onStop}
        >
          Stop sharing
        </button>
      ) : null}
    </div>
  );
}
