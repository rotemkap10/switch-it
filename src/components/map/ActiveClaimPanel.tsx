"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CancelClaimButton } from "@/components/map/CancelClaimButton";
import { ClaimNavigationActions } from "@/components/map/ClaimNavigationActions";
import { CompleteHandoffForm } from "@/components/map/CompleteHandoffForm";
import { SeekerShareLocationCard } from "@/components/map/SeekerShareLocationCard";
import { HandoffVehicleSection } from "@/components/vehicle/HandoffVehicleSection";
import { HandoffWindowCountdown } from "@/components/ui/HandoffWindowCountdown";
import {
  MAP_SHEET_CLASS,
  MAP_SHEET_HOST_CLASS,
} from "@/lib/map/bottom-stack";
import { seekerSpotAddressLabel } from "@/lib/geocoding/location-display";
import { useSeekerLiveLocationShare } from "@/lib/location/use-seeker-live-location-share";
import { isValidNavigationCoords } from "@/lib/map/navigation-urls";
import { VEHICLE_COLOR_LABELS } from "@/lib/vehicle/colors";
import {
  isCompleteHandoffVehicle,
  type HandoffVehicle,
} from "@/lib/vehicle/handoff-vehicle";
import { formatLicensePlateForDisplay } from "@/lib/vehicle/normalize-plate";
import { VEHICLE_TYPE_LABELS } from "@/lib/vehicle/types";

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

export const ACTIVE_CLAIM_DESTINATION_FALLBACK = "Parking spot on the map";

export function activeClaimDestinationLabel(
  spotAddress: string | null | undefined,
): string {
  return seekerSpotAddressLabel(spotAddress);
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
  ownVehicle,
  expanded,
  onToggleExpanded,
  sheetLabelId,
}: {
  claim: ActiveClaimSummary;
  destination: ActiveClaimDestination | null;
  counterpartVehicle: HandoffVehicle | null;
  ownVehicle: HandoffVehicle | null;
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
  const forceStopLiveShare = liveShare.forceStop;

  const onExpired = useCallback(() => {
    forceStopLiveShare();
    router.refresh();
  }, [forceStopLiveShare, router]);

  const onHandoffTerminal = useCallback(() => {
    forceStopLiveShare();
  }, [forceStopLiveShare]);

  const destinationLabel = activeClaimDestinationLabel(claim.spotAddress);
  const canNavigate =
    !!destination &&
    isValidNavigationCoords(destination.latitude, destination.longitude);
  const compactVehicleLabel =
    counterpartVehicle && isCompleteHandoffVehicle(counterpartVehicle)
      ? `${VEHICLE_COLOR_LABELS[counterpartVehicle.color!]} ${VEHICLE_TYPE_LABELS[counterpartVehicle.type!]} · ${formatLicensePlateForDisplay(counterpartVehicle.licensePlate!)}`
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
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="rounded-[calc(var(--radius-card)-4px)] bg-accent-soft px-3 py-2">
            <p className="text-xs font-semibold text-accent-hover">
              You’re on your way
            </p>
            <p
              id={sheetLabelId}
              className="mt-0.5 truncate text-sm font-medium text-foreground"
              title={destinationLabel}
            >
              {destinationLabel}
            </p>
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

      {canNavigate && destination ? (
        <div className="flex flex-col gap-1.5">
          <ClaimNavigationActions
            claimId={claim.claimId}
            latitude={destination.latitude}
            longitude={destination.longitude}
            fullWidth
          />
          <p className="text-center text-[0.7rem] leading-4 text-muted">
            Use Switch It controls only when safely stopped.
          </p>
        </div>
      ) : null}

      <HandoffWindowCountdown
        key={claim.spotExpiresAt}
        availableAtIso={claim.spotAvailableAt}
        expiresAtIso={claim.spotExpiresAt}
        role="seeker"
        onExpired={onExpired}
      />

      <SeekerShareLocationCard
        uiState={liveShare.uiState}
        resumedOnce={liveShare.resumedOnce}
        onShare={() => {
          void liveShare.startSharing();
        }}
        onStop={() => {
          void liveShare.stopSharing();
        }}
      />

      {!expanded && compactVehicleLabel ? (
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
        hidden={!expanded}
        className={
          expanded
            ? "map-bottom-sheet-scroll flex min-h-0 flex-1 flex-col gap-3 motion-fade-in"
            : undefined
        }
      >
        {expanded ? (
          <>
            {counterpartVehicle ? (
              <HandoffVehicleSection
                title="Look for this vehicle"
                helper="Meet the other driver before they pull away so you can take the spot smoothly."
                vehicle={counterpartVehicle}
                ownVehicle={ownVehicle}
                showRepresentativeNote
                approachAnimationKey={`seeker-${claim.claimId}`}
              />
            ) : null}
            <div
              className="map-bottom-sheet-actions"
              data-testid="active-claim-sticky-actions"
            >
              <CompleteHandoffForm
                claimId={claim.claimId}
                onCompleted={onHandoffTerminal}
              />
              <CancelClaimButton
                claimId={claim.claimId}
                onCancelled={onHandoffTerminal}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function ActiveClaimPanel({
  claim,
  destination = null,
  counterpartVehicle = null,
  ownVehicle = null,
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
      ownVehicle={ownVehicle}
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
