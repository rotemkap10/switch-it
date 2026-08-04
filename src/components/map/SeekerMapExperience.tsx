"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import {
  ActiveClaimPanel,
  type ActiveClaimDestination,
  type ActiveClaimSummary,
} from "@/components/map/ActiveClaimPanel";
import { OwnSpotNotice } from "@/components/map/OwnSpotNotice";
import { ParkingMapLoader } from "@/components/map/ParkingMapLoader";
import { Alert } from "@/components/ui/Alert";
import type { MapSpot } from "@/types/map-spot";

type SeekerMapExperienceProps = {
  spots: MapSpot[];
  destination: ActiveClaimDestination | null;
  activeClaim: ActiveClaimSummary | null;
  showOwnSpotNotice: boolean;
  spotsError: boolean;
  activeClaimError: boolean;
  ownedSpotError: boolean;
};

export function SeekerMapExperience({
  spots,
  destination,
  activeClaim,
  showOwnSpotNotice,
  spotsError,
  activeClaimError,
  ownedSpotError,
}: SeekerMapExperienceProps) {
  const [mapVisuallyReady, setMapVisuallyReady] = useState(false);
  const handleVisuallyReady = useCallback(() => {
    setMapVisuallyReady(true);
  }, []);

  const showEmptyOverlay =
    mapVisuallyReady &&
    !spotsError &&
    spots.length === 0 &&
    !activeClaim;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-bg-strong/50">
      {/* Map surface + exclusive loader until onVisuallyReady */}
      <div className="relative min-h-0 flex-1">
        {!spotsError ? (
          <ParkingMapLoader
            spots={spots}
            destination={destination}
            onVisuallyReady={handleVisuallyReady}
          />
        ) : (
          <div className="flex h-full min-h-[18rem] items-center justify-center p-4">
            <Alert tone="error">Map unavailable until spots can load.</Alert>
          </div>
        )}
      </div>

      {/* Overlays only after the map is visually ready */}
      {mapVisuallyReady ? (
        <>
          {/* Desktop-only compact title; mobile relies on bottom nav. */}
          {!activeClaim ? (
            <div
              data-testid="map-title-pill"
              className="pointer-events-none absolute left-3 top-3 z-20 hidden md:block"
            >
              <div className="pointer-events-auto rounded-full border border-border/80 bg-surface/95 px-3 py-1.5 text-xs font-semibold text-foreground shadow-[var(--shadow-card)] backdrop-blur-sm">
                Find parking
              </div>
            </div>
          ) : null}

          {spotsError || activeClaimError || ownedSpotError ? (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex flex-col gap-2 px-3 md:left-auto md:right-3 md:w-80">
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

          {showOwnSpotNotice ? (
            <div
              className={[
                "pointer-events-none absolute z-20 px-3",
                showEmptyOverlay
                  ? "left-3 top-[7.25rem] sm:left-auto sm:right-3 sm:top-3"
                  : "right-3 top-3",
              ].join(" ")}
            >
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
                variant="overlay"
              />
            </div>
          ) : null}

          {showEmptyOverlay ? (
            <div
              className={[
                "pointer-events-none absolute z-20 px-3",
                // Mobile: below header edge. Desktop: upper-left, not centered.
                "left-0 top-3 md:left-3 md:top-12",
              ].join(" ")}
            >
              <div
                data-testid="map-empty-overlay"
                className="pointer-events-auto w-[min(100%,20rem)] max-w-[20rem] rounded-[var(--radius-card)] border border-border bg-surface px-3.5 py-2.5 text-left shadow-[var(--shadow-card)] motion-fade-in"
              >
                <p className="text-sm font-semibold text-foreground">
                  No spots nearby yet
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  New spots will appear automatically.
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
