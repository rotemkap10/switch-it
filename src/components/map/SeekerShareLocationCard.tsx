"use client";

type SeekerShareLocationCardProps = {
  uiState: "idle" | "prompt" | "sharing" | "paused" | "unavailable" | "denied" | "off";
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

  const on =
    uiState === "sharing" ? "Live location on" : null;
  const paused = uiState === "paused" ? "Live location paused" : null;
  const off =
    uiState === "denied" || uiState === "unavailable" || uiState === "off"
      ? "Live location off"
      : null;
  const label = on ?? paused ?? off;
  if (!label) {
    return null;
  }

  const canStop = uiState === "sharing" || uiState === "paused";

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
