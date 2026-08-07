"use client";

import { useId, useState } from "react";

import { ClaimSpotButton } from "@/components/map/ClaimSpotButton";
import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { seekerSpotAddressLabel } from "@/lib/geocoding/location-display";
import {
  MAP_SHEET_CLASS,
  MAP_SHEET_HOST_CLASS,
} from "@/lib/map/bottom-stack";
import type { MapSpot } from "@/types/map-spot";

const PANEL_EXIT_MS = 200;

type SelectedSpotCardProps = {
  spot: MapSpot;
  onClose: () => void;
  /** Straight-line distance label when user location is known. */
  distanceLabel?: string | null;
};

export function SelectedSpotCard({
  spot,
  onClose,
  distanceLabel = null,
}: SelectedSpotCardProps) {
  const [closing, setClosing] = useState(false);
  const titleId = useId();

  function handleClose() {
    if (closing) {
      return;
    }
    setClosing(true);
    window.setTimeout(onClose, PANEL_EXIT_MS);
  }

  const addressLabel = seekerSpotAddressLabel(spot.address);

  return (
    <div
      className={MAP_SHEET_HOST_CLASS}
      data-testid="selected-spot-sheet-host"
    >
      <section
        role="region"
        aria-labelledby={titleId}
        data-testid="selected-spot-sheet"
        className={[
          "pointer-events-auto",
          MAP_SHEET_CLASS,
          "map-bottom-sheet--selected",
          closing ? "motion-panel-exit" : "motion-fade-slide-up",
        ].join(" ")}
      >
        <div className="map-sheet-handle" aria-hidden="true" />

        <div className="flex items-start justify-between gap-3">
          <div className="status-band min-w-0 flex-1 px-3 py-2">
            <p
              id={titleId}
              className="truncate text-sm font-semibold text-foreground"
              title={addressLabel}
            >
              {addressLabel}
            </p>
            <p className="mt-2 text-base">
              <Countdown
                targetIso={spot.available_at}
                pendingLabel="Available in"
                readyLabel="Available now"
              />
            </p>
            {distanceLabel ? (
              <p className="mt-1 truncate text-xs text-muted">{distanceLabel}</p>
            ) : null}
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
          <div className="flex flex-col gap-2" data-testid="selected-spot-claim-action">
            <p className="text-xs leading-5 text-muted">
              Claim this shared handoff if you can arrive in time. Parking is not
              guaranteed against other street drivers.
            </p>
            <ClaimSpotButton spotId={spot.id} />
          </div>
        ) : (
          <p className="text-sm text-muted">This is your published spot.</p>
        )}
      </section>
    </div>
  );
}
