import { CompleteClaimButton } from "@/components/map/CompleteClaimButton";

export type ActiveClaimSummary = {
  claimId: string;
  claimExpiresAt: string;
  spotAddress: string | null;
};

type ActiveClaimPanelProps = {
  claim: ActiveClaimSummary;
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ActiveClaimPanel({ claim }: ActiveClaimPanelProps) {
  return (
    <section className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
      <h2 className="font-semibold tracking-tight">Your active claim</h2>
      <p className="mt-1">
        {claim.spotAddress?.trim()
          ? claim.spotAddress
          : "Public street parking spot"}
      </p>
      <p className="mt-1 text-zinc-600">
        Claim expires: {formatDateTime(claim.claimExpiresAt)}
      </p>
      <div className="mt-3">
        <CompleteClaimButton claimId={claim.claimId} />
      </div>
    </section>
  );
}
