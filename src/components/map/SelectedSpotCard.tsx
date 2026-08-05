"use client";

import { useState } from "react";

import { ClaimSpotButton } from "@/components/map/ClaimSpotButton";
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import type { MapSpot } from "@/types/map-spot";

const PANEL_EXIT_MS = 160;

type SelectedSpotCardProps = {
  spot: MapSpot;
  onClose: () => void;
};

export function SelectedSpotCard({ spot, onClose }: SelectedSpotCardProps) {
  const [closing, setClosing] = useState(false);

  function handleClose() {
    if (closing) {
      return;
    }
    setClosing(true);
    window.setTimeout(onClose, PANEL_EXIT_MS);
  }

  return (
    <div
      className={[
        "pointer-events-none absolute z-[1000]",
        "inset-x-0 bottom-0 px-[var(--app-phone-gutter)] pt-3 app-overlay-pad-bottom",
        // Desktop: lower-left.
        "md:inset-x-auto md:bottom-4 md:left-4 md:right-auto md:w-full md:max-w-sm md:p-0 md:px-0",
      ].join(" ")}
    >
      <div
        className={[
          "pointer-events-auto flex w-full flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]",
          closing ? "motion-panel-exit" : "motion-fade-slide-up",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="status-band min-w-0 flex-1 px-3 py-2">
            <p className="text-sm font-semibold text-foreground">
              {spot.address?.trim()
                ? spot.address
                : "Public street parking spot"}
            </p>
            <p className="mt-2 text-base">
              <Countdown
                targetIso={spot.available_at}
                pendingLabel="Available in"
                readyLabel="Available now"
              />
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="shrink-0 px-2 py-1 text-muted"
            onClick={handleClose}
            aria-label="Close spot details"
          >
            Close
          </Button>
        </div>

        {spot.canClaim ? (
          <ClaimSpotButton spotId={spot.id} />
        ) : (
          <p className="text-sm text-muted">This is your published spot.</p>
        )}
      </div>
    </div>
  );
}
