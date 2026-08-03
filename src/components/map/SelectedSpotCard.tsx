"use client";

import { ClaimSpotButton } from "@/components/map/ClaimSpotButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Countdown } from "@/components/ui/Countdown";
import type { MapSpot } from "@/types/map-spot";

type SelectedSpotCardProps = {
  spot: MapSpot;
  onClose: () => void;
};

export function SelectedSpotCard({ spot, onClose }: SelectedSpotCardProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] p-3 sm:p-4">
      <Card className="pointer-events-auto mx-auto flex w-full max-w-md flex-col gap-3 motion-fade-in shadow-[var(--shadow-card)]">
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
            onClick={onClose}
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
      </Card>
    </div>
  );
}
