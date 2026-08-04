"use client";

import Link from "next/link";

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
  const showEmptyOverlay = !spotsError && spots.length === 0 && !activeClaim;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-bg-strong/50">
      {!activeClaim ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center px-3 pt-3">
          <div className="pointer-events-auto max-w-sm rounded-[var(--radius-card)] border border-border/80 bg-surface/95 px-4 py-2.5 text-center shadow-[var(--shadow-card)] backdrop-blur-sm">
            <p className="text-sm font-semibold text-foreground">Find parking</p>
            <p className="text-xs text-muted">Choose a spot nearby.</p>
          </div>
        </div>
      ) : null}

      {spotsError || activeClaimError || ownedSpotError ? (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-30 flex flex-col gap-2 px-3">
          {spotsError ? (
            <div className="pointer-events-auto mx-auto w-full max-w-md">
              <Alert tone="error">Could not load parking spots.</Alert>
            </div>
          ) : null}
          {activeClaimError ? (
            <div className="pointer-events-auto mx-auto w-full max-w-md">
              <Alert tone="error">Could not load your active trip.</Alert>
            </div>
          ) : null}
          {ownedSpotError ? (
            <div className="pointer-events-auto mx-auto w-full max-w-md">
              <Alert tone="error">Could not check your published spot.</Alert>
            </div>
          ) : null}
        </div>
      ) : null}

      {showOwnSpotNotice ? (
        <div
          className={[
            "pointer-events-none absolute inset-x-0 z-20 flex justify-center px-3 sm:top-3 sm:justify-end sm:pr-4",
            showEmptyOverlay ? "top-[9.5rem]" : "top-[4.75rem]",
          ].join(" ")}
        >
          <div className="pointer-events-auto">
            <OwnSpotNotice />
          </div>
        </div>
      ) : null}

      {activeClaim ? (
        <ActiveClaimPanel
          claim={activeClaim}
          destination={destination}
          variant="overlay"
        />
      ) : null}

      {/* Empty and own-spot overlays sit above the map, not in its place. */}
      {showEmptyOverlay ? (
        <div className="pointer-events-none absolute inset-x-0 top-[4.75rem] z-20 flex justify-center px-3">
          <div
            data-testid="map-empty-overlay"
            className="pointer-events-auto w-full max-w-xs rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3 text-center shadow-[var(--shadow-card)] motion-fade-in"
          >
            <p className="text-sm font-semibold text-foreground">
              No spots nearby yet
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              New spots will appear here automatically.
            </p>
            <Link
              href="/spots/new"
              className="mt-2 inline-block text-xs font-medium text-accent-hover underline-offset-2 hover:underline"
            >
              Leaving a spot? Share it
            </Link>
          </div>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        {!spotsError ? (
          <ParkingMapLoader spots={spots} destination={destination} />
        ) : (
          <div className="flex h-full min-h-[18rem] items-center justify-center p-4">
            <Alert tone="error">Map unavailable until spots can load.</Alert>
          </div>
        )}
      </div>
    </div>
  );
}
