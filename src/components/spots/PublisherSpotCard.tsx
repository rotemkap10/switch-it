"use client";

import { useEffect, useState } from "react";

import { CancelSpotButton } from "@/components/spots/CancelSpotButton";
import { HandoffCodeSection } from "@/components/spots/HandoffCodeSection";
import { PublisherSpotPreviewMapLoader } from "@/components/spots/PublisherSpotPreviewMapLoader";
import { ParkingPinSettle } from "@/components/illustrations/ParkingPinSettle";
import { HandoffVehicleSection } from "@/components/vehicle/HandoffVehicleSection";
import { Countdown } from "@/components/ui/Countdown";
import { formatDateTime } from "@/lib/format/time";
import { useOneShotAnimation } from "@/lib/motion/use-one-shot-animation";
import type { HandoffVehicle } from "@/lib/vehicle/handoff-vehicle";

export type PublisherSpotSummary = {
  id: string;
  status: "available" | "claimed";
  available_at: string;
  address: string | null;
  latitude: number;
  longitude: number;
};

type PublisherSpotCardProps = {
  spot: PublisherSpotSummary;
  layout?: "page" | "compact";
  /** Seeker vehicle for an active claim; omitted when unavailable. */
  counterpartVehicle?: HandoffVehicle | null;
  /** Owner handoff code for an active claim; omitted when unavailable. */
  handoffCode?: string | null;
};

export function publisherSpotTitleLabel(
  address: string | null | undefined,
): string {
  const trimmed = address?.trim();
  return trimmed ? trimmed : "Your parking spot";
}

export function PublisherSpotCard({
  spot,
  layout = "page",
  counterpartVehicle = null,
  handoffCode = null,
}: PublisherSpotCardProps) {
  const claimed = spot.status === "claimed";
  const [claimedEmphasis, setClaimedEmphasis] = useState(false);
  const destinationLabel = publisherSpotTitleLabel(spot.address);
  const hasValidCoords =
    Number.isFinite(spot.latitude) && Number.isFinite(spot.longitude);
  const waitingPin = useOneShotAnimation(
    !claimed ? `publisher-waiting-pin:${spot.id}` : null,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const statusKey = `switch-it:publisher-spot-status:${spot.id}`;
    const previous = window.sessionStorage.getItem(statusKey);
    window.sessionStorage.setItem(statusKey, spot.status);

    // One-shot when this session observed available → claimed (incl. Realtime).
    if (previous === "available" && spot.status === "claimed") {
      const playedKey = `switch-it:publisher-claimed-emphasis:${spot.id}`;
      if (window.sessionStorage.getItem(playedKey)) {
        return;
      }
      window.sessionStorage.setItem(playedKey, "1");
      const start = window.setTimeout(() => setClaimedEmphasis(true), 0);
      const stop = window.setTimeout(() => setClaimedEmphasis(false), 720);
      return () => {
        window.clearTimeout(start);
        window.clearTimeout(stop);
      };
    }
    return undefined;
  }, [spot.status, spot.id]);

  return (
    <div
      className={[
        "flex w-full flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] motion-fade-slide-up sm:p-5",
        layout === "page" ? "mx-auto max-w-lg md:max-w-2xl" : "",
      ].join(" ")}
      data-testid="publisher-spot-card"
      data-status={spot.status}
    >
      <div
        className={[
          "grid gap-4",
          layout === "page" ? "md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:items-start" : "",
        ].join(" ")}
      >
        <div
          className={[
            "rounded-[calc(var(--radius-card)-4px)] px-4 py-3",
            claimed ? "bg-success-bg" : "bg-accent-soft",
            claimedEmphasis ? "motion-soft-scale-in" : "",
          ].join(" ")}
          aria-live="polite"
        >
          <p className="text-xs font-semibold text-muted">
            {claimed ? "Driver coming" : "Live"}
          </p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <h2 className="text-xl font-semibold text-foreground">
              {claimed ? "A driver is on the way" : "Waiting for a driver"}
            </h2>
            {!claimed ? (
              <ParkingPinSettle
                className="mt-0.5 h-10 w-14 shrink-0"
                animate={waitingPin}
              />
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            {claimed
              ? "Please stay near the spot until the handoff."
              : "Your spot is visible to nearby drivers."}
          </p>

          <p className="mt-3 truncate text-sm font-medium text-foreground">
            {destinationLabel}
          </p>
          <p className="mt-2 text-lg">
            <Countdown
              targetIso={spot.available_at}
              pendingLabel="Available in"
              readyLabel="The spot should be available now"
            />
          </p>
          <p className="mt-2 text-xs text-muted">
            Leave time: {formatDateTime(spot.available_at)}
          </p>
        </div>

        {hasValidCoords ? (
          <PublisherSpotPreviewMapLoader
            latitude={spot.latitude}
            longitude={spot.longitude}
          />
        ) : null}
      </div>

      {claimed && counterpartVehicle ? (
        <div className="border-t border-border/70 pt-3">
          <HandoffVehicleSection
            title="Arriving vehicle"
            helper="This is the driver coming to your spot."
            vehicle={counterpartVehicle}
            showRepresentativeNote
            approachAnimationKey={`publisher-${spot.id}`}
          />
        </div>
      ) : null}

      {claimed && handoffCode ? (
        <div className="border-t border-border/70 pt-3">
          <HandoffCodeSection code={handoffCode} />
        </div>
      ) : null}

      <div className="border-t border-border/70 pt-3">
        <CancelSpotButton spotId={spot.id} />
      </div>
    </div>
  );
}
