import { CompleteClaimButton } from "@/components/map/CompleteClaimButton";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
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
    <Card className="flex flex-col gap-4 border-accent/30 bg-accent-soft/40">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">Active claim</Badge>
      </div>

      <div>
        <h2 className="text-base font-semibold text-foreground">
          Your active claim
        </h2>
        <p className="mt-1 text-sm text-foreground">
          {claim.spotAddress?.trim()
            ? claim.spotAddress
            : "Public street parking spot"}
        </p>
        <p className="mt-2 text-base font-semibold text-foreground">
          <Countdown
            targetIso={claim.spotAvailableAt}
            pendingLabel="Available in"
            readyLabel="Available now"
          />
        </p>
        <p className="mt-1 text-sm text-muted">
          Expected leave time: {formatDateTime(claim.spotAvailableAt)}
        </p>
        <p className="mt-1 text-sm text-muted">
          Claim expires: {formatDateTime(claim.claimExpiresAt)}
        </p>
      </div>

      <Alert tone="info">
        Before the leave time, the owner is still preparing to leave. When the
        countdown reaches zero, the spot should be available for handoff.
      </Alert>

      <CompleteClaimButton claimId={claim.claimId} />
    </Card>
  );
}
