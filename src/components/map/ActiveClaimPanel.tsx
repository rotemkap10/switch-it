"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CancelClaimButton } from "@/components/map/CancelClaimButton";
import { ClaimNavigationActions } from "@/components/map/ClaimNavigationActions";
import { useOptionalPostClaimNavigation } from "@/components/map/PostClaimNavigationProvider";
import { CompleteHandoffForm } from "@/components/map/CompleteHandoffForm";
import { SeekerShareLocationCard } from "@/components/map/SeekerShareLocationCard";
import { PublisherSpotPreviewMapLoader } from "@/components/spots/PublisherSpotPreviewMapLoader";
import { HandoffVehicleSection } from "@/components/vehicle/HandoffVehicleSection";
import { HandoffWindowCountdown } from "@/components/ui/HandoffWindowCountdown";
import {
  MAP_SHEET_CLASS,
  MAP_SHEET_HOST_CLASS,
} from "@/lib/map/bottom-stack";
import { sanitizeLocationLabel } from "@/lib/geocoding/sanitize-location-label";
import { registerSeekerLiveLocationStarter } from "@/lib/location/seeker-live-location-intent";
import { useSeekerLiveLocationShare } from "@/lib/location/use-seeker-live-location-share";
import { isCloseToSpot } from "@/lib/map/distance";
import { useDistanceToSpot } from "@/lib/map/use-distance-to-spot";
import { isValidNavigationCoords } from "@/lib/map/navigation-urls";
import { VEHICLE_COLOR_LABELS } from "@/lib/vehicle/colors";
import {
  formatVehicleNameForDisplay,
  isCompleteHandoffVehicle,
  type HandoffVehicle,
} from "@/lib/vehicle/handoff-vehicle";
import { formatLicensePlateForDisplay } from "@/lib/vehicle/normalize-plate";

export type ActiveClaimSummary = {
  claimId: string;
  claimExpiresAt: string;
  spotAvailableAt: string;
  spotExpiresAt: string;
  spotAddress: string | null;
};

export type ActiveClaimDestination = {
  latitude: number;
  longitude: number;
};

export const ACTIVE_CLAIM_DESTINATION_FALLBACK = "Exact location marked on map";
export const ACTIVE_CLAIM_ON_WAY_STATUS = "You’re on your way";
export const ACTIVE_CLAIM_CLOSE_STATUS = "You’re close to the parking spot";

export function activeClaimDestinationLabel(
  spotAddress: string | null | undefined,
): string {
  return sanitizeLocationLabel(spotAddress) ?? ACTIVE_CLAIM_DESTINATION_FALLBACK;
}

type ActiveClaimPanelProps = {
  claim: ActiveClaimSummary;
  destination?: ActiveClaimDestination | null;
  counterpartVehicle?: HandoffVehicle | null;
  ownVehicle?: HandoffVehicle | null;
  variant?: "card" | "overlay";
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
};

function ExpandChevron({ expanded }: { expanded: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={[
        "inline-block text-muted transition-transform duration-[var(--motion-standard)] ease-[var(--motion-ease)]",
        expanded ? "rotate-180" : "",
      ].join(" ")}
    >
      ▾
    </span>
  );
}

function ActiveClaimSheetBody({
  claim,
  destination,
  counterpartVehicle,
  expanded,
  onToggleExpanded,
  sheetLabelId,
}: {
  claim: ActiveClaimSummary;
  destination: ActiveClaimDestination | null;
  counterpartVehicle: HandoffVehicle | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  sheetLabelId: string;
}) {
  const router = useRouter();
  const liveShare = useSeekerLiveLocationShare({
    claimId: claim.claimId,
    spotExpiresAtIso: claim.spotExpiresAt,
    enabled: true,
  });
  const startSharing = liveShare.startSharing;
  const forceStopLiveShare = liveShare.forceStop;

  useEffect(() => {
    return registerSeekerLiveLocationStarter(() => {
      void startSharing();
    });
  }, [startSharing]);

  const onExpired = useCallback(() => {
    forceStopLiveShare();
    router.refresh();
  }, [forceStopLiveShare, router]);

  const onHandoffTerminal = useCallback(() => {
    forceStopLiveShare();
  }, [forceStopLiveShare]);

  const destinationLabel = activeClaimDestinationLabel(claim.spotAddress);
  const { label: distanceLabel, meters: distanceMeters } =
    useDistanceToSpot(destination);
  const closeToSpot = isCloseToSpot(distanceMeters);
  const navigation = useOptionalPostClaimNavigation();
  const sessionDestination =
    navigation?.session?.claimId === claim.claimId
      ? {
          latitude: navigation.session.latitude,
          longitude: navigation.session.longitude,
        }
      : null;
  const navigateDestination =
    destination &&
    isValidNavigationCoords(destination.latitude, destination.longitude)
      ? destination
      : sessionDestination &&
          isValidNavigationCoords(
            sessionDestination.latitude,
            sessionDestination.longitude,
          )
        ? sessionDestination
        : null;
  const canNavigate = Boolean(navigateDestination);
  const showDetails = expanded || closeToSpot;
  const compactVehicleLabel =
    counterpartVehicle && isCompleteHandoffVehicle(counterpartVehicle)
      ? `${formatVehicleNameForDisplay(`${counterpartVehicle.make} ${counterpartVehicle.model}`)} · ${VEHICLE_COLOR_LABELS[counterpartVehicle.color!]} · ${formatLicensePlateForDisplay(counterpartVehicle.licensePlate!)}`
      : null;

  return (
    <div
      className={[
        MAP_SHEET_CLASS,
        expanded
          ? "map-bottom-sheet--claim-expanded active-claim-sheet-expanded"
          : "map-bottom-sheet--claim-collapsed active-claim-sheet-collapsed",
        "motion-fade-slide-up",
      ].join(" ")}
      data-testid="active-claim-sheet"
      data-arrival={closeToSpot ? "close" : "en-route"}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div
            className={[
              "rounded-[calc(var(--radius-card)-4px)] px-3 py-2",
              closeToSpot ? "bg-success-bg" : "bg-accent-soft",
            ].join(" ")}
          >
            <p className="text-xs font-semibold text-accent-hover">
              {closeToSpot
                ? ACTIVE_CLAIM_CLOSE_STATUS
                : ACTIVE_CLAIM_ON_WAY_STATUS}
            </p>
            <HandoffWindowCountdown
              key={claim.spotExpiresAt}
              availableAtIso={claim.spotAvailableAt}
              expiresAtIso={claim.spotExpiresAt}
              role="seeker"
              className="mt-1"
              onExpired={onExpired}
            />
          </div>
        </div>

        <button
          type="button"
          className="motion-interactive-press shrink-0 rounded-lg px-2 py-2 text-sm text-muted hover:bg-accent-soft hover:text-foreground"
          aria-expanded={expanded}
          aria-controls="active-claim-details"
          aria-label={
            expanded ? "Collapse claim details" : "Expand claim details"
          }
          onClick={onToggleExpanded}
        >
          <span className="sr-only">{expanded ? "Collapse" : "Expand"}</span>
          <span className="map-sheet-handle" aria-hidden="true" />
          <ExpandChevron expanded={expanded} />
        </button>
      </div>

      {canNavigate && navigateDestination ? (
        <ClaimNavigationActions
          claimId={claim.claimId}
          latitude={navigateDestination.latitude}
          longitude={navigateDestination.longitude}
        />
      ) : null}

      <div data-testid="active-claim-location">
        <p className="text-xs font-medium text-muted">Parking spot</p>
        <p
          id={sheetLabelId}
          className="truncate text-sm font-medium text-foreground"
          title={destinationLabel}
          data-testid="active-claim-address"
        >
          {destinationLabel}
        </p>
        {distanceLabel ? (
          <p
            className="mt-0.5 text-sm font-medium text-foreground"
            data-testid="active-claim-distance"
          >
            {distanceLabel}
          </p>
        ) : null}
        {expanded && canNavigate && navigateDestination ? (
          <div className="mt-2">
            <PublisherSpotPreviewMapLoader
              latitude={navigateDestination.latitude}
              longitude={navigateDestination.longitude}
              variant="handoff"
              ariaLabel="Exact parking location"
              testId="claim-destination-preview-map"
            />
          </div>
        ) : null}
      </div>

      {!showDetails && compactVehicleLabel ? (
        <p
          className="truncate text-xs font-medium text-foreground"
          data-testid="active-claim-compact-vehicle"
          title={compactVehicleLabel}
        >
          {compactVehicleLabel}
        </p>
      ) : null}

      <div
        id="active-claim-details"
        hidden={!showDetails}
        className={showDetails ? "flex flex-col gap-3 motion-fade-in" : undefined}
      >
        {showDetails && counterpartVehicle ? (
          <HandoffVehicleSection
            title="Look for this vehicle"
            vehicle={counterpartVehicle}
            approachAnimationKey={`seeker-${claim.claimId}`}
          />
        ) : null}
      </div>

      <SeekerShareLocationCard
        uiState={liveShare.uiState}
        resumedOnce={liveShare.resumedOnce}
        onStop={() => {
          void liveShare.stopSharing();
        }}
      />

      {showDetails ? (
        <div
          className="map-bottom-sheet-actions"
          data-testid="active-claim-complete-actions"
        >
          <CompleteHandoffForm
            claimId={claim.claimId}
            onCompleted={onHandoffTerminal}
            emphasized={closeToSpot}
          />
          <CancelClaimButton
            claimId={claim.claimId}
            onCancelled={onHandoffTerminal}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ActiveClaimPanel({
  claim,
  destination = null,
  counterpartVehicle = null,
  variant = "card",
  expanded: expandedProp,
  onExpandedChange,
}: ActiveClaimPanelProps) {
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(true);
  const expanded = expandedProp ?? uncontrolledExpanded;
  const onExpandedChangeRef = useRef(onExpandedChange);

  useEffect(() => {
    onExpandedChangeRef.current = onExpandedChange;
  }, [onExpandedChange]);

  const setExpanded = (next: boolean) => {
    if (expandedProp === undefined) {
      setUncontrolledExpanded(next);
    }
    onExpandedChangeRef.current?.(next);
  };
  const sheetLabelId = useId();

  useEffect(() => {
    if (!expanded) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
        return;
      }
      event.preventDefault();
      if (expandedProp === undefined) {
        setUncontrolledExpanded(false);
      }
      onExpandedChangeRef.current?.(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expanded, expandedProp]);

  const body = (
    <ActiveClaimSheetBody
      claim={claim}
      destination={destination}
      counterpartVehicle={counterpartVehicle}
      expanded={expanded}
      onToggleExpanded={() => setExpanded(!expanded)}
      sheetLabelId={sheetLabelId}
    />
  );

  if (variant === "overlay") {
    return (
      <div
        className={`${MAP_SHEET_HOST_CLASS} map-bottom-sheet-host--claim md:left-4 md:right-auto md:w-full md:max-w-sm md:px-4`}
        data-testid="active-claim-overlay-host"
      >
        <section
          className="pointer-events-auto"
          role="region"
          aria-labelledby={sheetLabelId}
        >
          {body}
        </section>
      </div>
    );
  }

  return (
    <section
      role="region"
      aria-labelledby={sheetLabelId}
      className="w-full max-w-md"
    >
      {body}
    </section>
  );
}
