"use client";

import type { SeekerShareUiState } from "@/lib/location/use-seeker-live-location-share";

type SeekerShareLocationCardProps = {
  uiState: SeekerShareUiState;
  resumedOnce?: boolean;
};

/**
 * Compact live-location status for an active handoff.
 * Sharing is mandatory for the claim — there is no Stop sharing control.
 */
export function SeekerShareLocationCard({
  uiState,
}: SeekerShareLocationCardProps) {
  if (uiState === "idle" || uiState === "prompt") {
    return null;
  }

  const label =
    uiState === "acquiring"
      ? "Starting…"
      : uiState === "waiting"
        ? "Waiting for GPS…"
        : uiState === "weak"
          ? "Location signal is weak"
          : uiState === "sharing"
            ? "Live location on"
            : uiState === "paused"
              ? "Live location paused"
              : uiState === "denied"
                ? "Location permission needed"
                : uiState === "unavailable" || uiState === "off"
                  ? "Live location delayed"
                  : null;
  if (!label) {
    return null;
  }

  const needsAttention =
    uiState === "denied" || uiState === "unavailable" || uiState === "off";

  return (
    <div
      className="flex flex-col gap-1"
      data-testid="seeker-share-location"
      data-state={uiState === "off" ? "off" : uiState}
      aria-live="polite"
    >
      <p
        className={[
          "inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-medium leading-4",
          needsAttention
            ? "bg-danger-bg text-danger"
            : "bg-accent-soft text-muted",
        ].join(" ")}
      >
        {label}
      </p>
      {needsAttention ? (
        <p
          className="text-xs leading-5 text-muted"
          data-testid="seeker-share-location-hint"
        >
          {uiState === "denied"
            ? "Enable location for Switch It, or release the spot to end the handoff."
            : "Trying to resume automatically. Release the spot if you can’t share location."}
        </p>
      ) : null}
    </div>
  );
}
