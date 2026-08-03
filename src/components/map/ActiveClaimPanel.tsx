import { CancelClaimButton } from "@/components/map/CancelClaimButton";
import { CompleteClaimButton } from "@/components/map/CompleteClaimButton";
import { Card } from "@/components/ui/Card";
import { Countdown } from "@/components/ui/Countdown";
import { formatDateTime } from "@/lib/format/time";

export type ActiveClaimSummary = {
  claimId: string;
  claimExpiresAt: string;
  spotAvailableAt: string;
  spotAddress: string | null;
};

type ActiveClaimPanelProps = {
  claim: ActiveClaimSummary;
};

export function ActiveClaimPanel({ claim }: ActiveClaimPanelProps) {
  return (
    <Card className="flex flex-col gap-4 motion-fade-in">
      <div className="status-band px-4 py-3">
        <p className="text-sm font-semibold text-accent-hover">
          You’re on your way
        </p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">
          {claim.spotAddress?.trim()
            ? claim.spotAddress
            : "Public street parking spot"}
        </h2>
        <p className="mt-3 text-lg">
          <Countdown
            targetIso={claim.spotAvailableAt}
            pendingLabel="Available in"
            readyLabel="Available now"
          />
        </p>
      </div>

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
