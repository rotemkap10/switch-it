"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CancelClaimButton } from "@/components/map/CancelClaimButton";
import { ClaimNavigationActions } from "@/components/map/ClaimNavigationActions";
import { useOptionalPostClaimNavigation } from "@/components/map/PostClaimNavigationProvider";
import { SeekerShareLocationCard } from "@/components/map/SeekerShareLocationCard";
import { HandoffVehicleSection } from "@/components/vehicle/HandoffVehicleSection";
import { HandoffWindowCountdown } from "@/components/ui/HandoffWindowCountdown";
import {
  MAP_SHEET_CLASS,
  MAP_SHEET_HOST_CLASS,
} from "@/lib/map/bottom-stack";
import { sanitizeLocationLabel } from "@/lib/geocoding/sanitize-location-label";
import { registerSeekerLiveLocationStarter } from "@/lib/location/seeker-live-location-intent";
import {
  useSeekerLiveLocationShare,
  type SeekerLiveLocationShareApi,
} from "@/lib/location/use-seeker-live-location-share";
import { isCloseToSpot } from "@/lib/map/distance";
import { useDistanceToSpot } from "@/lib/map/use-distance-to-spot";
import { isValidNavigationCoords } from "@/lib/map/navigation-urls";
import { reconcileClaimTiming } from "@/actions/reconcile-claim";
import { hasHandoffStarted } from "@/lib/spots/handoff-phase";
import {
  formatVehicleIdentityTitle,
  isCompleteHandoffVehicle,
  type HandoffVehicle,
} from "@/lib/vehicle/handoff-vehicle";

export type ActiveClaimSummary = {
  claimId: string;
  spotId?: string | null;
  claimExpiresAt: string;
  spotAvailableAt: string;
  spotExpiresAt: string;
  handoffStartedAt?: string | null;
  spotAddress: string | null;
};

export type ActiveClaimDestination = {
  latitude: number;
  longitude: number;
};

export const ACTIVE_CLAIM_DESTINATION_FALLBACK = "Exact location marked on map";
export const ACTIVE_CLAIM_ON_WAY_STATUS = "You’re on your way";
export const ACTIVE_CLAIM_CLOSE_STATUS = "You’re close to the parking spot";
export const ACTIVE_CLAIM_WAITING_CONFIRMATION =
  "Waiting for vehicle confirmation";

export function activeClaimDestinationLabel(
  spotAddress: string | null | undefined,
): string {
  return sanitizeLocationLabel(spotAddress) ?? ACTIVE_CLAIM_DESTINATION_FALLBACK;
}

export function activeClaimCompactVehicleLabel(
  vehicle: HandoffVehicle | null | undefined,
): string | null {
  if (!vehicle || !isCompleteHandoffVehicle(vehicle)) {
    return null;
  }
  return `${formatVehicleIdentityTitle(vehicle.make!, vehicle.model!, null)} · ${vehicle.licensePlateMasked}`;
}

type ActiveClaimPanelProps = {
  claim: ActiveClaimSummary;
  destination?: ActiveClaimDestination | null;
  counterpartVehicle?: HandoffVehicle | null;
  ownVehicle?: HandoffVehicle | null;
  variant?: "card" | "overlay";
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** When provided, sharing is owned by the parent (starts before the map is ready). */
  liveShare?: SeekerLiveLocationShareApi;
};

function HandoffPanelChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={expanded ? "" : "rotate-180"}
    >
      <path
        d="M5 7.5 10 12.5 15 7.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActiveClaimSheetBody({
  claim,
  destination,
  counterpartVehicle,
  expanded,
  onToggleExpanded,
  sheetLabelId,
  liveShare: liveShareOverride,
}: {
  claim: ActiveClaimSummary;
  destination: ActiveClaimDestination | null;
  counterpartVehicle: HandoffVehicle | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  sheetLabelId: string;
  liveShare?: SeekerLiveLocationShareApi;
}) {
  const router = useRouter();
  const ownedShare = useSeekerLiveLocationShare({
    claimId: claim.claimId,
    spotId: claim.spotId,
    spotExpiresAtIso: claim.spotExpiresAt,
    enabled: !liveShareOverride,
    manageNativeTracker: !liveShareOverride,
  });
  const liveShare = liveShareOverride ?? ownedShare;
  const startSharing = liveShare.startSharing;
  const forceStopLiveShare = liveShare.forceStop;
  const sharingOwnedByParent = Boolean(liveShareOverride);

  useEffect(() => {
    if (sharingOwnedByParent) {
      return;
    }
    return registerSeekerLiveLocationStarter(() => {
      void startSharing();
    });
  }, [sharingOwnedByParent, startSharing]);

  // Start live sharing as soon as the active claim is shown — mandatory for
  // every handoff. Navigation-provider taps are independent and optional.
  useEffect(() => {
    if (sharingOwnedByParent) {
      return;
    }
    void startSharing();
  }, [sharingOwnedByParent, startSharing]);

  // Permission revoke / extended outage: keep retrying until sharing resumes
  // or the seeker releases the spot. Short GPS gaps are handled inside the hook.
  useEffect(() => {
    if (
      liveShare.uiState !== "denied" &&
      liveShare.uiState !== "unavailable" &&
      liveShare.uiState !== "off"
    ) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void startSharing();
    }, 8_000);
    return () => window.clearInterval(intervalId);
  }, [liveShare.uiState, startSharing]);

  const onExpired = useCallback(() => {
    forceStopLiveShare();
    router.refresh();
  }, [forceStopLiveShare, router]);

  const onDepartureDue = useCallback(() => {
    void reconcileClaimTiming(claim.claimId);
  }, [claim.claimId]);

  const onHandoffTerminal = useCallback(() => {
    forceStopLiveShare();
  }, [forceStopLiveShare]);

  const { meters: distanceMeters } =
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
  const compactVehicleLabel = activeClaimCompactVehicleLabel(counterpartVehicle);

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
      data-expanded={expanded ? "true" : "false"}
    >
      <div
        className={
          expanded
            ? "flex items-start gap-2"
            : "flex min-h-0 items-center gap-2"
        }
        data-testid={expanded ? undefined : "active-claim-collapsed-summary"}
      >
        <div className="min-w-0 flex-1 overflow-hidden">
          <div
            className={
              expanded
                ? [
                    "rounded-[calc(var(--radius-card)-4px)] px-3 py-2",
                    closeToSpot ? "bg-success-bg" : "bg-accent-soft",
                  ].join(" ")
                : undefined
            }
          >
            <p
              id={sheetLabelId}
              className={
                expanded
                  ? "text-xs font-semibold text-accent-hover"
                  : "sr-only"
              }
            >
              {closeToSpot
                ? ACTIVE_CLAIM_CLOSE_STATUS
                : ACTIVE_CLAIM_ON_WAY_STATUS}
            </p>
            <HandoffWindowCountdown
              key={claim.spotExpiresAt}
              availableAtIso={claim.spotAvailableAt}
              expiresAtIso={claim.spotExpiresAt}
              handoffStartedAtIso={claim.handoffStartedAt}
              claimed
              role="seeker"
              compact={!expanded}
              proximity={closeToSpot ? "close" : null}
              className={
                expanded
                  ? "mt-1"
                  : "[&_p:not(.sr-only)]:truncate text-sm font-semibold leading-5"
              }
              onExpired={onExpired}
              onDepartureDue={onDepartureDue}
            />
            {!expanded && compactVehicleLabel ? (
              <p
                className="truncate text-xs font-medium leading-4 text-muted"
                data-testid="active-claim-compact-vehicle"
                title={compactVehicleLabel}
              >
                {compactVehicleLabel}
              </p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          data-testid="active-claim-expand-toggle"
          className={[
            "motion-interactive-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            "text-foreground",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            expanded
              ? "border border-border bg-surface shadow-[var(--shadow-card)] transition-opacity hover:bg-surface/95"
              : "bg-transparent",
          ].join(" ")}
          aria-expanded={expanded}
          aria-controls="active-claim-details"
          aria-label={
            expanded ? "Collapse handoff details" : "Expand handoff details"
          }
          onClick={onToggleExpanded}
        >
          <HandoffPanelChevron expanded={expanded} />
        </button>
      </div>

      {expanded && canNavigate && navigateDestination ? (
        <ClaimNavigationActions
          claimId={claim.claimId}
          latitude={navigateDestination.latitude}
          longitude={navigateDestination.longitude}
        />
      ) : null}

      <div
        id="active-claim-details"
        hidden={!expanded}
        className={expanded ? "flex flex-col gap-3 motion-fade-in" : undefined}
      >
        {expanded && counterpartVehicle ? (
          <HandoffVehicleSection
            title="Look for this vehicle"
            vehicle={counterpartVehicle}
          />
        ) : null}
      </div>

      {expanded ? (
        <SeekerShareLocationCard
          uiState={liveShare.uiState}
          resumedOnce={liveShare.resumedOnce}
        />
      ) : null}

      {expanded ? (
        <div
          className="map-bottom-sheet-actions"
          data-testid="active-claim-complete-actions"
        >
          {hasHandoffStarted(claim.handoffStartedAt) ? (
            <p
              className="text-sm font-medium text-foreground"
              data-testid="seeker-waiting-confirmation"
            >
              {ACTIVE_CLAIM_WAITING_CONFIRMATION}
            </p>
          ) : null}
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
  liveShare,
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
      liveShare={liveShare}
    />
  );

  if (variant === "overlay") {
    return (
      <div
        className={`${MAP_SHEET_HOST_CLASS} map-bottom-sheet-host--claim pointer-events-none md:left-4 md:right-auto md:w-full md:max-w-sm md:px-4`}
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
