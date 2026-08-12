"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { CancelSpotButton } from "@/components/spots/CancelSpotButton";
import { ExtendHandoffWaitButton } from "@/components/spots/ExtendHandoffWaitButton";
import { HandoffCodeSection } from "@/components/spots/HandoffCodeSection";
import { PublisherLiveProgressMapLoader } from "@/components/spots/PublisherLiveProgressMapLoader";
import { ParkingPinSettle } from "@/components/illustrations/ParkingPinSettle";
import { HandoffVehicleSection } from "@/components/vehicle/HandoffVehicleSection";
import {
  getHandoffPhase,
  HandoffWindowCountdown,
} from "@/components/ui/HandoffWindowCountdown";
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
import type { HandoffVehicle } from "@/lib/vehicle/handoff-vehicle";

export type PublisherSpotSummary = {
  id: string;
  status: "available" | "claimed";
  available_at: string;
  expires_at: string;
  address: string | null;
  latitude: number;
  longitude: number;
};

export const PUBLISHER_WAITING_STATUS = "Waiting for a driver";
export const PUBLISHER_CLAIMED_STATUS = "Your spot has been claimed";
export const PUBLISHER_CLAIMED_STAY_INSTRUCTION =
  "Stay at the parking spot until the driver arrives.";
export const PUBLISHER_CLAIMED_NEARBY_INSTRUCTION =
  "Driver is approaching the parking spot";

type PublisherSpotCardProps = {
  spot: PublisherSpotSummary;
  layout?: "page" | "compact";
  counterpartVehicle?: HandoffVehicle | null;
  ownVehicle?: HandoffVehicle | null;
  handoffCode?: string | null;
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
  handoffCode = null,
  activeClaimId = null,
}: PublisherSpotCardProps) {
  const router = useRouter();
  const claimed = spot.status === "claimed";
  const [claimedEmphasis, setClaimedEmphasis] = useState(false);
  const [liveMapExpanded, setLiveMapExpanded] = useState(false);
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
          <h2 className="text-lg font-semibold text-foreground sm:text-xl">
            {claimed ? PUBLISHER_CLAIMED_STATUS : PUBLISHER_WAITING_STATUS}
          </h2>
          {claimed ? (
            <p
              className="mt-1 text-sm text-muted"
              data-testid="publisher-claimed-instruction"
            >
              {driverNearby
                ? PUBLISHER_CLAIMED_NEARBY_INSTRUCTION
                : PUBLISHER_CLAIMED_STAY_INSTRUCTION}
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
      <div className={claimed ? "mt-2" : "mt-3"}>
        <HandoffWindowCountdown
          key={spot.expires_at}
          availableAtIso={spot.available_at}
          expiresAtIso={spot.expires_at}
          role="publisher"
          onExpired={onExpired}
        />
      </div>
    </div>
  );

  const vehicleBlock =
    claimed && counterpartVehicle ? (
      <div className="border-t border-border/60 pt-3">
        <HandoffVehicleSection
          title="Look for this vehicle"
          vehicle={counterpartVehicle}
          approachAnimationKey={`publisher-${spot.id}`}
        />
      </div>
    ) : null;

  const mapBlock =
    claimed && activeClaimId && parkingLatLng ? (
      <div className="border-t border-border/60 pt-3 md:border-t-0 md:pt-0">
        <PublisherLiveProgressMapLoader
          parkingLatitude={parkingLatLng.latitude}
          parkingLongitude={parkingLatLng.longitude}
          seekerLocation={liveLocation.location}
          statusLabel={liveLocation.statusLabel}
          updatedLabel={liveLocation.updatedLabel}
          pauseHint={liveLocation.pauseHint}
          progressLabel={driverProgressLabel}
          expanded={liveMapExpanded}
          onExpandedChange={setLiveMapExpanded}
        />
      </div>
    ) : null;

  const parkingContextBlock = claimed ? (
    <div
      className="border-t border-border/60 pt-3"
      data-testid="publisher-parking-context"
    >
      <p className="text-xs font-medium text-muted">Parking spot</p>
      <p
        className="truncate text-sm font-medium text-foreground"
        title={destinationLabel}
        data-testid="publisher-parking-address"
      >
        {destinationLabel}
      </p>
    </div>
  ) : null;

  const handoffBlock =
    claimed && handoffCode ? (
      <div className="motion-fade-in" data-testid="publisher-handoff-priority">
        <HandoffCodeSection code={handoffCode} />
      </div>
    ) : null;

  const cancelBlock = (
    <div className="publisher-spot-cancel flex flex-col gap-2">
      {claimed &&
      activeClaimId &&
      canOfferHandoffExtension({
        availableAtIso: spot.available_at,
        expiresAtIso: spot.expires_at,
        claimed: true,
      }) &&
      getHandoffPhase(spot.available_at, spot.expires_at) === "window" ? (
        <ExtendHandoffWaitButton
          claimId={activeClaimId}
          availableAtIso={spot.available_at}
          expiresAtIso={spot.expires_at}
        />
      ) : null}
      <CancelSpotButton spotId={spot.id} claimed={claimed} />
    </div>
  );

  const usePageGrid = layout === "page";

  return (
    <div
      className={[
        "publisher-spot-card flex w-full flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] motion-fade-slide-up sm:gap-4 sm:p-5",
        usePageGrid ? "mx-auto max-w-lg md:max-w-2xl" : "",
      ].join(" ")}
      data-testid="publisher-spot-card"
      data-status={spot.status}
      data-driver-nearby={claimed && driverNearby ? "true" : "false"}
    >
      {usePageGrid && mapBlock ? (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:items-start md:gap-4">
          <div className="flex flex-col gap-3 md:col-start-1">
            {statusBlock}
            {vehicleBlock}
          </div>
          <div className="md:col-start-2 md:row-start-1">{mapBlock}</div>
          <div className="flex flex-col gap-3 md:col-span-2">
            {parkingContextBlock}
            {handoffBlock}
            {cancelBlock}
          </div>
        </div>
      ) : (
        <>
          {statusBlock}
          {vehicleBlock}
          {mapBlock}
          {parkingContextBlock}
          {handoffBlock}
          {cancelBlock}
        </>
      )}
    </div>
  );
}
