import { CancelClaimButton } from "@/components/map/CancelClaimButton";
import { ClaimNavigationActions } from "@/components/map/ClaimNavigationActions";
import { CompleteClaimButton } from "@/components/map/CompleteClaimButton";
import { ActiveClaimStatusBand } from "@/components/map/ActiveClaimStatusBand";
import { Card } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/format/time";
import { isValidNavigationCoords } from "@/lib/map/navigation-urls";

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

type ActiveClaimPanelProps = {
  claim: ActiveClaimSummary;
  /** Claimed spot coordinates for external navigation only. */
  destination?: ActiveClaimDestination | null;
};

export function ActiveClaimPanel({
  claim,
  destination = null,
}: ActiveClaimPanelProps) {
  const canNavigate =
    !!destination &&
    isValidNavigationCoords(destination.latitude, destination.longitude);

  return (
    <Card className="flex flex-col gap-4 motion-fade-slide-up">
      <ActiveClaimStatusBand
        spotAvailableAt={claim.spotAvailableAt}
        spotAddress={claim.spotAddress}
      />

      {canNavigate && destination ? (
        <ClaimNavigationActions
          latitude={destination.latitude}
          longitude={destination.longitude}
        />
      ) : null}

      <div className="space-y-1 text-sm text-muted">
        <p>Leave time: {formatDateTime(claim.spotAvailableAt)}</p>
        <p>Hold until: {formatDateTime(claim.claimExpiresAt)}</p>
      </div>

      <p className="text-sm leading-6 text-muted">
        When the countdown reaches zero, the spot should be free for you to take.
      </p>

      <div className="flex flex-col gap-3">
        <CompleteClaimButton claimId={claim.claimId} />
        <CancelClaimButton claimId={claim.claimId} />
      </div>
    </Card>
  );
}
