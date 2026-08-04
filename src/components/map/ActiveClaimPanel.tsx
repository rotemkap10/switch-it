"use client";

import { useState } from "react";

import { CancelClaimButton } from "@/components/map/CancelClaimButton";
import { ClaimNavigationActions } from "@/components/map/ClaimNavigationActions";
import { CompleteClaimButton } from "@/components/map/CompleteClaimButton";
import { ActiveClaimStatusBand } from "@/components/map/ActiveClaimStatusBand";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/format/time";
import { isValidNavigationCoords } from "@/lib/map/navigation-urls";

export type ActiveClaimSummary = {
  claimId: string;
  claimExpiresAt: string;
  spotAvailableAt: string;
  spotAddress: string | null;
};

export type ActiveClaimDestination = {
  latitude: number;
  longitude: number;
};

type ActiveClaimPanelProps = {
  claim: ActiveClaimSummary;
  /** Claimed spot coordinates for external navigation only. */
  destination?: ActiveClaimDestination | null;
  /** Overlay sits on the map; default is a stacked page card. */
  variant?: "card" | "overlay";
};

export function ActiveClaimPanel({
  claim,
  destination = null,
  variant = "card",
}: ActiveClaimPanelProps) {
  const [detailsOpen, setDetailsOpen] = useState(true);
  const canNavigate =
    !!destination &&
    isValidNavigationCoords(destination.latitude, destination.longitude);

  if (variant === "overlay") {
    return (
      <>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[25] flex justify-center px-3 pt-3 md:justify-start">
          <div className="pointer-events-auto w-full max-w-sm motion-fade-slide-up">
            <ActiveClaimStatusBand
              spotAvailableAt={claim.spotAvailableAt}
              spotAddress={claim.spotAddress}
              compact
            />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[25] p-3 md:left-4 md:right-auto md:w-full md:max-w-sm">
          <div className="pointer-events-auto flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface/95 p-3 shadow-[var(--shadow-card)] backdrop-blur-sm motion-fade-slide-up">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium text-foreground">
                {claim.spotAddress?.trim()
                  ? claim.spotAddress
                  : "Public street parking spot"}
              </p>
              <Button
                type="button"
                variant="ghost"
                className="shrink-0 px-2 py-1 text-xs text-muted"
                aria-expanded={detailsOpen}
                onClick={() => setDetailsOpen((open) => !open)}
              >
                {detailsOpen ? "Less" : "Details"}
              </Button>
            </div>

            {canNavigate && destination ? (
              <ClaimNavigationActions
                latitude={destination.latitude}
                longitude={destination.longitude}
              />
            ) : null}

            {detailsOpen ? (
              <div className="space-y-1 text-xs text-muted">
                <p>Leave time: {formatDateTime(claim.spotAvailableAt)}</p>
                <p>Hold until: {formatDateTime(claim.claimExpiresAt)}</p>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <CompleteClaimButton claimId={claim.claimId} />
              <CancelClaimButton claimId={claim.claimId} />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] motion-fade-slide-up">
      <ActiveClaimStatusBand
        spotAvailableAt={claim.spotAvailableAt}
        spotAddress={claim.spotAddress}
      />

      {canNavigate && destination ? (
        <ClaimNavigationActions
          latitude={destination.latitude}
          longitude={destination.longitude}
        />
      ) : null}

      <div className="space-y-1 text-sm text-muted">
        <p>Leave time: {formatDateTime(claim.spotAvailableAt)}</p>
        <p>Hold until: {formatDateTime(claim.claimExpiresAt)}</p>
      </div>

      <p className="text-sm leading-6 text-muted">
        When the countdown reaches zero, the spot should be free for you to take.
      </p>

      <div className="flex flex-col gap-3">
        <CompleteClaimButton claimId={claim.claimId} />
        <CancelClaimButton claimId={claim.claimId} />
      </div>
    </div>
  );
}
