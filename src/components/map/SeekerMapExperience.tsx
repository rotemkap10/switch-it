"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ActiveClaimPanel,
  type ActiveClaimDestination,
  type ActiveClaimSummary,
} from "@/components/map/ActiveClaimPanel";
import { useOptionalPostClaimNavigation } from "@/components/map/PostClaimNavigationProvider";
import { OwnSpotNotice } from "@/components/map/OwnSpotNotice";
import { ParkingMapLoader } from "@/components/map/ParkingMapLoader";
import { Alert } from "@/components/ui/Alert";
import { useReportInitialMapReady } from "@/components/shell/AppLaunchReadyContext";
import { registerSeekerHandoffForceStop } from "@/lib/handoff/seeker-handoff-terminal";
import { stopHandoffTrackingBestEffort } from "@/lib/location/handoff-location-service";
import { registerSeekerLiveLocationStarter } from "@/lib/location/seeker-live-location-intent";
import { useSeekerLiveLocationShare } from "@/lib/location/use-seeker-live-location-share";
import {
  syncDocumentMapBottomStack,
  type MapBottomStack,
} from "@/lib/map/bottom-stack";
import {
  clearSeekerMapPresentation,
  reportSeekerMapPresentation,
} from "@/lib/map/seeker-map-presentation";
import { useSeekerDiscoverySpots } from "@/lib/map/use-seeker-discovery-spots";
import type { HandoffVehicle } from "@/lib/vehicle/handoff-vehicle";
import type { MapSpot } from "@/types/map-spot";

type SeekerMapExperienceProps = {
  spots: MapSpot[];
  userId: string;
  destination: ActiveClaimDestination | null;
  activeClaim: ActiveClaimSummary | null;
  counterpartVehicle?: HandoffVehicle | null;
  ownVehicle?: HandoffVehicle | null;
  showOwnSpotNotice: boolean;
  spotsError: boolean;
  activeClaimError: boolean;
  ownedSpotError: boolean;
  releasedSpotIds?: readonly string[];
};

export function SeekerMapExperience({
  spots: serverSpots,
  userId,
  destination,
  activeClaim,
  counterpartVehicle = null,
  ownVehicle = null,
  showOwnSpotNotice,
  spotsError,
  activeClaimError,
  ownedSpotError,
  releasedSpotIds = [],
}: SeekerMapExperienceProps) {
  const reportInitialMapReady = useReportInitialMapReady();
  const spots = useSeekerDiscoverySpots({
    serverSpots,
    userId,
    enabled: !spotsError,
    releasedSpotIds,
  });
  const [mapVisuallyReady, setMapVisuallyReady] = useState(false);
  const [claimExpanded, setClaimExpanded] = useState(true);
  const [expandedForClaimId, setExpandedForClaimId] = useState<string | null>(
    null,
  );
  const handleVisuallyReady = useCallback(() => {
    setMapVisuallyReady(true);
    reportInitialMapReady();
  }, [reportInitialMapReady]);

  const activeClaimIdForPresentation = activeClaim?.claimId ?? null;

  useEffect(() => {
    reportSeekerMapPresentation({
      visuallyReady: mapVisuallyReady || spotsError,
      activeClaimId: activeClaimIdForPresentation,
    });
  }, [mapVisuallyReady, spotsError, activeClaimIdForPresentation]);

  useEffect(() => {
    return () => {
      clearSeekerMapPresentation();
    };
  }, []);

  useEffect(() => {
    if (spotsError) {
      // No map will mount — release cold-launch splash to show the error UI.
      reportInitialMapReady();
    }
  }, [spotsError, reportInitialMapReady]);

  const liveShare = useSeekerLiveLocationShare({
    claimId: activeClaim?.claimId ?? "",
    spotId: activeClaim?.spotId ?? null,
    spotExpiresAtIso: activeClaim?.spotExpiresAt ?? "",
    enabled: Boolean(activeClaim),
  });
  const startSharing = liveShare.startSharing;
  const forceStop = liveShare.forceStop;
  const navigation = useOptionalPostClaimNavigation();
  const previousClaimIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeClaim) {
      return;
    }
    return registerSeekerHandoffForceStop(() => {
      forceStop();
    });
  }, [activeClaim, forceStop]);

  useEffect(() => {
    if (!activeClaim) {
      return;
    }
    void startSharing();
  }, [activeClaim, startSharing]);

  useEffect(() => {
    if (!activeClaim) {
      return;
    }
    return registerSeekerLiveLocationStarter(() => {
      void startSharing();
    });
  }, [activeClaim, startSharing]);

  // When the active claim ends (remote cancel, expiry, refresh), stop sharing,
  // close navigation UI, and clear native tracking.
  useEffect(() => {
    const previousClaimId = previousClaimIdRef.current;
    const nextClaimId = activeClaim?.claimId ?? null;
    previousClaimIdRef.current = nextClaimId;

    if (previousClaimId && !nextClaimId) {
      forceStop();
      navigation?.clearSession();
      void stopHandoffTrackingBestEffort("claim_ended");
    }
  }, [activeClaim, forceStop, navigation]);

  const activeClaimId = activeClaim?.claimId ?? null;
  if (activeClaimId !== expandedForClaimId) {
    setExpandedForClaimId(activeClaimId);
    if (activeClaimId) {
      setClaimExpanded(true);
    }
  }

  const claimBottomStack: MapBottomStack | null = activeClaim
    ? claimExpanded
      ? "claim-expanded"
      : "claim-collapsed"
    : null;

  useEffect(() => {
    if (!claimBottomStack) {
      return;
    }
    syncDocumentMapBottomStack(claimBottomStack);
    return () => {
      syncDocumentMapBottomStack(null);
    };
  }, [claimBottomStack]);

  const showEmptyOverlay =
    mapVisuallyReady &&
    !spotsError &&
    spots.length === 0 &&
    !activeClaim;

  const showOwnSpot =
    mapVisuallyReady && showOwnSpotNotice && !activeClaim;

  return (
    <div
      data-testid="seeker-map-stage"
      className="relative min-h-0 flex-1"
      data-map-bottom={claimBottomStack ?? undefined}
    >
      {/* Absolute fill: concrete height from flex parent, not content/min-height. */}
      <div className="absolute inset-0" data-testid="seeker-map-surface">
        {!spotsError ? (
          <ParkingMapLoader
            spots={spots}
            destination={destination}
            onVisuallyReady={handleVisuallyReady}
            showDiscoveryCarousel={!activeClaim}
            bottomStackOverride={claimBottomStack}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-4">
            <Alert tone="error">Map unavailable until spots can load.</Alert>
          </div>
        )}
      </div>

      {/* Overlays only after the map is visually ready — absolute, out of flow */}
      {mapVisuallyReady ? (
        <>
          {spotsError || activeClaimError || ownedSpotError ? (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex flex-col gap-2 px-[var(--app-phone-gutter)] md:left-auto md:right-3 md:w-80">
              {spotsError ? (
                <div className="pointer-events-auto">
                  <Alert tone="error">Could not load parking spots.</Alert>
                </div>
              ) : null}
              {activeClaimError ? (
                <div className="pointer-events-auto">
                  <Alert tone="error">Could not load your active trip.</Alert>
                </div>
              ) : null}
              {ownedSpotError ? (
                <div className="pointer-events-auto">
                  <Alert tone="error">
                    Could not check your published spot.
                  </Alert>
                </div>
              ) : null}
            </div>
          ) : null}

          {showOwnSpot ? (
            <div className="pointer-events-none absolute right-3 top-3 z-20">
              <div className="pointer-events-auto">
                <OwnSpotNotice />
              </div>
            </div>
          ) : null}

          {activeClaim ? (
            <div
              className="pointer-events-none absolute inset-0 z-30"
              data-testid="active-claim-map-layer"
            >
              <ActiveClaimPanel
                claim={activeClaim}
                destination={destination}
                counterpartVehicle={counterpartVehicle}
                ownVehicle={ownVehicle}
                variant="overlay"
                expanded={claimExpanded}
                onExpandedChange={setClaimExpanded}
                liveShare={liveShare}
              />
            </div>
          ) : null}

          {showEmptyOverlay ? (
            <div
              className={[
                "pointer-events-none absolute z-20",
                "left-[var(--app-phone-gutter)] top-3",
              ].join(" ")}
            >
              <div
                data-testid="map-empty-overlay"
                className="map-empty-notice pointer-events-auto rounded-[var(--radius-card)] border border-border bg-surface px-3.5 py-2.5 text-left shadow-[var(--shadow-card)] motion-fade-in"
              >
                <p className="text-sm font-semibold text-foreground">
                  No spots nearby yet
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  New spots will appear here automatically.
                </p>
                <Link
                  href="/spots/new"
                  className="mt-1.5 inline-block text-xs font-medium text-accent-hover underline-offset-2 hover:underline"
                >
                  Share a spot
                </Link>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
