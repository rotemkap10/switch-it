"use client";

import { useState } from "react";

type SeekerShareLocationCardProps = {
  uiState: "idle" | "prompt" | "sharing" | "paused" | "unavailable" | "denied";
  resumedOnce?: boolean;
  onShare: () => void;
  onStop: () => void;
};

/**
 * Compact consent + status for seeker live-location sharing.
 * Does not request browser permission until Share is tapped.
 */
export function SeekerShareLocationCard({
  uiState,
  resumedOnce = false,
  onShare,
  onStop,
}: SeekerShareLocationCardProps) {
  const [dismissedPrompt, setDismissedPrompt] = useState(false);

  if (uiState === "idle") {
    return null;
  }

  if (uiState === "denied" || uiState === "unavailable") {
    return (
      <div
        className="rounded-[calc(var(--radius-card)-4px)] border border-border bg-surface px-3 py-3"
        data-testid="seeker-share-location"
        data-state={uiState}
      >
        <p className="text-sm font-semibold text-foreground">
          Live location is unavailable
        </p>
        <p className="mt-1 text-xs text-muted">
          You can still complete the handoff using navigation, vehicle details,
          and the handoff code.
        </p>
      </div>
    );
  }

  if (uiState === "sharing" || uiState === "paused") {
    return (
      <div
        className="rounded-[calc(var(--radius-card)-4px)] border border-border bg-accent-soft px-3 py-3"
        data-testid="seeker-share-location"
        data-state={uiState}
        aria-live="polite"
      >
        <p className="text-sm font-semibold text-foreground">
          {uiState === "paused"
            ? "Live location paused"
            : "Sharing live location"}
        </p>
        <p className="mt-1 text-xs text-muted">
          {resumedOnce && uiState === "sharing"
            ? "Live location resumed. The parking owner can see your progress while Switch It is open."
            : "The parking owner can see your progress while Switch It is open."}
        </p>
        <button
          type="button"
          className="motion-interactive-press mt-3 min-h-[var(--app-tap-min)] w-full rounded-xl border border-border bg-surface px-3 text-sm font-medium text-foreground"
          onClick={onStop}
        >
          Stop sharing
        </button>
      </div>
    );
  }

  if (dismissedPrompt) {
    return (
      <div
        className="rounded-[calc(var(--radius-card)-4px)] px-1 py-1"
        data-testid="seeker-share-location"
        data-state="dismissed"
      >
        <button
          type="button"
          className="text-sm font-medium text-accent-hover underline-offset-2 hover:underline"
          onClick={() => {
            setDismissedPrompt(false);
            onShare();
          }}
        >
          Share live location
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-[calc(var(--radius-card)-4px)] border border-border bg-surface px-3 py-3"
      data-testid="seeker-share-location"
      data-state="prompt"
    >
      <p className="text-sm font-semibold text-foreground">
        Share your live location
      </p>
      <p className="mt-1 text-xs text-muted">
        Share your live location so the parking owner can see you approaching and
        is more likely to wait for you.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          className="motion-interactive-press min-h-[var(--app-tap-min)] w-full rounded-xl bg-accent px-3 text-sm font-semibold text-white"
          onClick={onShare}
        >
          Share live location
        </button>
        <button
          type="button"
          className="motion-interactive-press min-h-[var(--app-tap-min)] w-full rounded-xl px-3 text-sm font-medium text-muted"
          onClick={() => setDismissedPrompt(true)}
          data-testid="seeker-share-not-now"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
