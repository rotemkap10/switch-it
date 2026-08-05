"use client";

import { useEffect, useId, useRef, useState } from "react";

import { CancelClaimButton } from "@/components/map/CancelClaimButton";
import { ClaimNavigationActions } from "@/components/map/ClaimNavigationActions";
import { CompleteHandoffForm } from "@/components/map/CompleteHandoffForm";
import { HandoffVehicleSection } from "@/components/vehicle/HandoffVehicleSection";
import { Countdown } from "@/components/ui/Countdown";
import { formatDateTime } from "@/lib/format/time";
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
  spotAddress: string | null;
};

export type ActiveClaimDestination = {
  latitude: number;
  longitude: number;
};

export const ACTIVE_CLAIM_DESTINATION_FALLBACK = "Parking spot destination";

export function activeClaimDestinationLabel(
  spotAddress: string | null | undefined,
): string {
  const trimmed = spotAddress?.trim();
  return trimmed ? trimmed : ACTIVE_CLAIM_DESTINATION_FALLBACK;
}

type ActiveClaimPanelProps = {
  claim: ActiveClaimSummary;
  /** Claimed spot coordinates for external navigation only. */
  destination?: ActiveClaimDestination | null;
  /** Owner vehicle for an active handoff; omitted when unavailable. */
  counterpartVehicle?: HandoffVehicle | null;
  /** Overlay sits on the map; default is a stacked page card. */
  variant?: "card" | "overlay";
};

function useAvailability(spotAvailableAt: string) {
  const [now, setNow] = useState(() => Date.now());
  const [readyEmphasis, setReadyEmphasis] = useState(false);
  const wasReadyRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const target = new Date(spotAvailableAt).getTime();
  const isReady = !Number.isNaN(target) && target - now <= 0;

  useEffect(() => {
    if (isReady && !wasReadyRef.current) {
      wasReadyRef.current = true;
      setReadyEmphasis(true);
      const timer = window.setTimeout(() => setReadyEmphasis(false), 520);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isReady]);

  return { isReady, readyEmphasis };
}

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
  const { isReady, readyEmphasis } = useAvailability(claim.spotAvailableAt);
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
        "flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface/95 p-3 shadow-[var(--shadow-card)] backdrop-blur-sm",
        "motion-fade-slide-up",
        expanded ? "active-claim-sheet-expanded" : "active-claim-sheet-collapsed",
      ].join(" ")}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div
            className={[
              "rounded-[calc(var(--radius-card)-4px)] px-3 py-2",
              isReady ? "bg-success-bg" : "bg-accent-soft",
              readyEmphasis ? "motion-ready-emphasis" : "",
            ].join(" ")}
            aria-live="polite"
          >
            {isReady ? (
              <>
                <p className="text-sm font-semibold text-foreground">
                  The spot should be available now
                </p>
                <p
                  id={sheetLabelId}
                  className="mt-0.5 truncate text-xs text-muted"
                >
                  {destinationLabel}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-accent-hover">
                  You’re on your way
                </p>
                <p
                  id={sheetLabelId}
                  className="mt-0.5 truncate text-sm font-medium text-foreground"
                >
                  {destinationLabel}
                </p>
                <p className="mt-1 text-sm">
                  <Countdown
                    targetIso={claim.spotAvailableAt}
                    pendingLabel="Available in"
                    readyLabel="The spot should be available now"
                  />
                </p>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          className="motion-interactive-press shrink-0 rounded-lg px-2 py-2 text-sm text-muted hover:bg-accent-soft hover:text-foreground"
          aria-expanded={expanded}
          aria-controls="active-claim-details"
          aria-label={expanded ? "Collapse claim details" : "Expand claim details"}
          onClick={onToggleExpanded}
        >
          <span className="sr-only">{expanded ? "Collapse" : "Expand"}</span>
          <span
            className="mx-auto mb-1 block h-1 w-8 rounded-full bg-border"
            aria-hidden="true"
          />
          <ExpandChevron expanded={expanded} />
        </button>
      </div>

      {canNavigate && destination ? (
        <ClaimNavigationActions
          latitude={destination.latitude}
          longitude={destination.longitude}
          fullWidth
        />
      ) : null}

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
        className={expanded ? "flex flex-col gap-3 motion-fade-in" : undefined}
      >
        {expanded ? (
          <>
            {counterpartVehicle ? (
              <HandoffVehicleSection
                title="Look for this vehicle"
                helper="Check the model, color, and plate before completing the handoff."
                vehicle={counterpartVehicle}
                showRepresentativeNote
                approachAnimationKey={`seeker-${claim.claimId}`}
              />
            ) : null}
            <div className="space-y-1 text-xs text-muted">
              <p>Leave time: {formatDateTime(claim.spotAvailableAt)}</p>
              <p>Hold until: {formatDateTime(claim.claimExpiresAt)}</p>
            </div>
            <p className="text-xs leading-5 text-muted">
              When the countdown reaches zero, the spot should be free for you
              to take.
            </p>
            <CompleteHandoffForm claimId={claim.claimId} />
            <CancelClaimButton claimId={claim.claimId} />
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
  variant = "card",
}: ActiveClaimPanelProps) {
  // Start expanded so actions are discoverable; session-only preference.
  const [expanded, setExpanded] = useState(true);
  const sheetLabelId = useId();

  useEffect(() => {
    if (!expanded) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      // Let open dialogs (e.g. Navigate sheet) handle Escape first.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
        return;
      }
      event.preventDefault();
      setExpanded(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  const body = (
    <ActiveClaimSheetBody
      claim={claim}
      destination={destination}
      counterpartVehicle={counterpartVehicle}
      expanded={expanded}
      onToggleExpanded={() => setExpanded((value) => !value)}
      sheetLabelId={sheetLabelId}
    />
  );

  if (variant === "overlay") {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[30] px-[var(--app-phone-gutter)] pt-3 app-overlay-pad-bottom md:left-4 md:right-auto md:w-full md:max-w-sm md:px-4">
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
