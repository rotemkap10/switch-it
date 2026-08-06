"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  ActiveClaimPanel,
  type ActiveClaimDestination,
  type ActiveClaimSummary,
} from "@/components/map/ActiveClaimPanel";
import { OwnSpotNotice } from "@/components/map/OwnSpotNotice";
import { ParkingMapLoader } from "@/components/map/ParkingMapLoader";
import { Alert } from "@/components/ui/Alert";
import {
  syncDocumentMapBottomStack,
  type MapBottomStack,
} from "@/lib/map/bottom-stack";
import type { HandoffVehicle } from "@/lib/vehicle/handoff-vehicle";
import type { MapSpot } from "@/types/map-spot";

type SeekerMapExperienceProps = {
  spots: MapSpot[];
  destination: ActiveClaimDestination | null;
  activeClaim: ActiveClaimSummary | null;
  counterpartVehicle?: HandoffVehicle | null;
  showOwnSpotNotice: boolean;
  spotsError: boolean;
  activeClaimError: boolean;
  ownedSpotError: boolean;
};

export function SeekerMapExperience({
  spots,
  destination,
  activeClaim,
  counterpartVehicle = null,
  showOwnSpotNotice,
  spotsError,
  activeClaimError,
  ownedSpotError,
}: SeekerMapExperienceProps) {
  const [mapVisuallyReady, setMapVisuallyReady] = useState(false);
  const [claimExpanded, setClaimExpanded] = useState(true);
  const [expandedForClaimId, setExpandedForClaimId] = useState<string | null>(
    null,
  );
  const handleVisuallyReady = useCallback(() => {
    setMapVisuallyReady(true);
  }, []);

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
            <div className="absolute inset-0 z-30">
              <ActiveClaimPanel
                claim={activeClaim}
                destination={destination}
                counterpartVehicle={counterpartVehicle}
                variant="overlay"
                expanded={claimExpanded}
                onExpandedChange={setClaimExpanded}
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
