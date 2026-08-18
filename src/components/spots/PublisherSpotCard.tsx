"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { CancelSpotButton } from "@/components/spots/CancelSpotButton";
import { ExtendHandoffWaitButton } from "@/components/spots/ExtendHandoffWaitButton";
import { StartHandoffNowButton } from "@/components/spots/StartHandoffNowButton";
import { PublisherLiveProgressMapLoader } from "@/components/spots/PublisherLiveProgressMapLoader";
import { ParkingPinSettle } from "@/components/illustrations/ParkingPinSettle";
import { HandoffVehicleSection } from "@/components/vehicle/HandoffVehicleSection";
import { HandoffWindowCountdown } from "@/components/ui/HandoffWindowCountdown";
import { publisherSpotAddressLabel } from "@/lib/geocoding/location-display";
import { usePublisherLiveLocation } from "@/lib/location/use-publisher-live-location";
import {
  formatPublisherDriverProgress,
  haversineDistanceMeters,
  isCloseToSpot,
  isValidLatLng,
} from "@/lib/map/distance";
import { useOneShotAnimation } from "@/lib/motion/use-one-shot-animation";
import { sensoryClaimReceived } from "@/lib/sensory/feedback";
import { canOfferHandoffExtension } from "@/lib/spots/constants";
import {
  hasHandoffStarted,
  resolveHandoffTimingPhase,
} from "@/lib/spots/handoff-phase";
import type { HandoffVehicle } from "@/lib/vehicle/handoff-vehicle";

export type PublisherSpotSummary = {
  id: string;
  status: "available" | "claimed";
  available_at: string;
  expires_at: string;
  handoff_started_at: string | null;
  handoff_extension_used_at: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
};

export const PUBLISHER_WAITING_STATUS = "Waiting for a driver";
/** Compact claimed headline — map is the primary surface. */
export const PUBLISHER_CLAIMED_STATUS = "Driver on the way";
export const PUBLISHER_CONFIRM_STATUS = "Ready to leave?";
export const PUBLISHER_CLAIMED_STAY_INSTRUCTION = "Stay at your parking spot.";
export const PUBLISHER_CLAIMED_NEARBY_INSTRUCTION =
  "Driver is approaching the parking spot";

type PublisherSpotCardProps = {
  spot: PublisherSpotSummary;
  layout?: "page" | "compact";
  counterpartVehicle?: HandoffVehicle | null;
  ownVehicle?: HandoffVehicle | null;
  /** Active claim id when status is claimed — required for live location. */
  activeClaimId?: string | null;
};

export function publisherSpotTitleLabel(
  address: string | null | undefined,
): string {
  return publisherSpotAddressLabel(address);
}

export function PublisherSpotCard({
  spot,
  layout = "page",
  counterpartVehicle = null,
  activeClaimId = null,
}: PublisherSpotCardProps) {
  const router = useRouter();
  const claimed = spot.status === "claimed";
  const [claimedEmphasis, setClaimedEmphasis] = useState(false);
  const started = hasHandoffStarted(spot.handoff_started_at);
  const phase = resolveHandoffTimingPhase({
    availableAtIso: spot.available_at,
    expiresAtIso: spot.expires_at,
    handoffStartedAtIso: spot.handoff_started_at,
  });
  const destinationLabel = publisherSpotTitleLabel(spot.address);
  const parkingLatLng = isValidLatLng({
    latitude: spot.latitude,
    longitude: spot.longitude,
  })
    ? { latitude: spot.latitude, longitude: spot.longitude }
    : null;
  const waitingPin = useOneShotAnimation(
    !claimed ? `publisher-waiting-pin:${spot.id}` : null,
  );
  const liveLocation = usePublisherLiveLocation({
    claimId: claimed ? activeClaimId : null,
    enabled: claimed && !!activeClaimId,
  });
  const clearLiveLocation = liveLocation.clear;
  const seekerLatLng = liveLocation.location
    ? {
        latitude: liveLocation.location.latitude,
        longitude: liveLocation.location.longitude,
      }
    : null;
  const driverMeters =
    parkingLatLng && isValidLatLng(seekerLatLng)
      ? haversineDistanceMeters(seekerLatLng, parkingLatLng)
      : null;
  const driverNearby = isCloseToSpot(driverMeters);
  const driverProgressLabel =
    driverMeters == null ? null : formatPublisherDriverProgress(driverMeters);

  const onExpired = useCallback(() => {
    clearLiveLocation();
    router.refresh();
  }, [clearLiveLocation, router]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const statusKey = `switch-it:publisher-spot-status:${spot.id}`;
    const previous = window.sessionStorage.getItem(statusKey);
    window.sessionStorage.setItem(statusKey, spot.status);

    if (previous === "available" && spot.status === "claimed") {
      sensoryClaimReceived({
        previousStatus: previous,
        nextStatus: spot.status,
        claimId: activeClaimId,
        spotId: spot.id,
      });
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
  }, [spot.status, spot.id, activeClaimId]);

  // Clear ephemeral live state when claim ends (spot becomes available again).
  useEffect(() => {
    if (!claimed) {
      clearLiveLocation();
    }
  }, [claimed, clearLiveLocation]);

  const claimedHeadline =
    phase === "confirm"
      ? PUBLISHER_CONFIRM_STATUS
      : driverNearby
        ? PUBLISHER_CLAIMED_NEARBY_INSTRUCTION
        : PUBLISHER_CLAIMED_STATUS;
  const waitingHeadline =
    phase === "confirm" ? PUBLISHER_CONFIRM_STATUS : PUBLISHER_WAITING_STATUS;
  const claimedSecondary = !activeClaimId
    ? PUBLISHER_CLAIMED_STAY_INSTRUCTION
    : liveLocation.freshness === "waiting" ||
        liveLocation.freshness === "live" ||
        liveLocation.freshness === "delayed" ||
        liveLocation.freshness === "paused" ||
        liveLocation.freshness === "unavailable"
      ? liveLocation.statusLabel
      : PUBLISHER_CLAIMED_STAY_INSTRUCTION;

  const statusBlock = (
    <div
      className={[
        "publisher-spot-status",
        claimed ? "bg-success-bg" : "bg-accent-soft",
        claimedEmphasis ? "motion-soft-scale-in" : "",
      ].join(" ")}
      aria-live="polite"
      data-testid="publisher-spot-status"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2
            className={[
              "font-semibold text-foreground",
              claimed ? "text-base sm:text-lg" : "text-lg sm:text-xl",
            ].join(" ")}
          >
            {claimed ? claimedHeadline : waitingHeadline}
          </h2>
          {claimed ? (
            <p
              className="mt-1 text-sm text-muted"
              data-testid="publisher-claimed-instruction"
            >
              {claimedSecondary}
            </p>
          ) : null}
        </div>
        {!claimed ? (
          <ParkingPinSettle
            className="mt-0.5 h-9 w-12 shrink-0 sm:h-10 sm:w-14"
            animate={waitingPin}
          />
        ) : null}
      </div>

      {!claimed ? (
        <p
          className="mt-3 truncate text-sm font-medium text-foreground"
          title={destinationLabel}
        >
          {destinationLabel}
        </p>
      ) : null}
      <div className="mt-3">
        <HandoffWindowCountdown
          key={spot.expires_at}
          availableAtIso={spot.available_at}
          expiresAtIso={spot.expires_at}
          handoffStartedAtIso={spot.handoff_started_at}
          role="publisher"
          onExpired={onExpired}
        />
      </div>
    </div>
  );

  const mapBlock =
    claimed && activeClaimId && parkingLatLng ? (
      <div data-testid="publisher-claimed-map-priority">
        <PublisherLiveProgressMapLoader
          parkingLatitude={parkingLatLng.latitude}
          parkingLongitude={parkingLatLng.longitude}
          seekerLocation={liveLocation.location}
          statusLabel={liveLocation.statusLabel}
          updatedLabel={liveLocation.updatedLabel}
          pauseHint={liveLocation.pauseHint}
          progressLabel={driverProgressLabel}
          expanded
          compactChrome
        />
      </div>
    ) : null;

  const vehicleBlock =
    claimed && counterpartVehicle ? (
      <div className="border-t border-border/60 pt-3">
        <HandoffVehicleSection
          title=""
          vehicle={counterpartVehicle}
          compact
        />
      </div>
    ) : null;

  const cancelBlock = (
    <div className="publisher-spot-cancel flex flex-col gap-2">
      {!started && phase !== "ended" ? (
        <StartHandoffNowButton spotId={spot.id} />
      ) : null}
      {claimed &&
      activeClaimId &&
      spot.handoff_started_at &&
      canOfferHandoffExtension({
        handoffStartedAtIso: spot.handoff_started_at,
        extensionUsedAtIso: spot.handoff_extension_used_at,
        expiresAtIso: spot.expires_at,
        claimed: true,
      }) &&
      phase === "active" ? (
        <ExtendHandoffWaitButton
          claimId={activeClaimId}
          handoffStartedAtIso={spot.handoff_started_at}
          expiresAtIso={spot.expires_at}
        />
      ) : null}
      <CancelSpotButton
        spotId={spot.id}
        claimId={activeClaimId}
        claimed={claimed}
        handoffStarted={started}
      />
    </div>
  );

  return (
    <div
      className={[
        "publisher-spot-card flex w-full flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] motion-fade-slide-up sm:gap-4 sm:p-5",
        layout === "page" ? "mx-auto max-w-lg md:max-w-2xl" : "",
      ].join(" ")}
      data-testid="publisher-spot-card"
      data-status={spot.status}
      data-handoff-phase={phase}
      data-driver-nearby={claimed && driverNearby ? "true" : "false"}
      data-layout={claimed ? "claimed-map-first" : "waiting"}
    >
      {claimed ? (
        <>
          {statusBlock}
          {mapBlock}
          {vehicleBlock}
          {cancelBlock}
        </>
      ) : (
        <>
          {statusBlock}
          {cancelBlock}
        </>
      )}
    </div>
  );
}
