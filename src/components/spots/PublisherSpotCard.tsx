import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Countdown } from "@/components/ui/Countdown";
import { formatDateTime } from "@/lib/format/time";

export type PublisherSpotSummary = {
  id: string;
  status: "available" | "claimed";
  available_at: string;
  address: string | null;
};

type PublisherSpotCardProps = {
  spot: PublisherSpotSummary;
};

export function PublisherSpotCard({ spot }: PublisherSpotCardProps) {
  const claimed = spot.status === "claimed";

  return (
    <Card
      className={[
        "flex flex-col gap-3 border-accent/30 bg-surface",
        "md:fixed md:bottom-6 md:right-6 md:z-40 md:w-80 md:shadow-[var(--shadow-card)]",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={claimed ? "accent" : "neutral"}>
          {claimed ? "Claimed" : "Published"}
        </Badge>
        <span className="text-sm font-medium text-foreground">Your spot</span>
      </div>

      <p className="text-sm text-foreground">
        {spot.address?.trim() ? spot.address : "Public street parking spot"}
      </p>

      <p className="text-sm font-semibold text-foreground">
        <Countdown
          targetIso={spot.available_at}
          pendingLabel="Leaving in"
          readyLabel="Available now"
        />
      </p>

      <p className="text-xs text-muted">
        Handoff time: {formatDateTime(spot.available_at)}
      </p>

      {claimed ? (
        <p className="text-sm font-medium text-accent">A driver is on the way</p>
      ) : (
        <p className="text-sm text-muted">Waiting for a driver to claim</p>
      )}
    </Card>
  );
}
