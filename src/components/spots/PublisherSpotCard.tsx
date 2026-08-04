import { CancelSpotButton } from "@/components/spots/CancelSpotButton";
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
  layout?: "page" | "compact";
};

export function PublisherSpotCard({
  spot,
  layout = "page",
}: PublisherSpotCardProps) {
  const claimed = spot.status === "claimed";

  return (
    <Card
      className={[
        "flex flex-col gap-4 motion-fade-slide-up",
        layout === "page" ? "max-w-lg" : "",
      ].join(" ")}
    >
      <div
        className={[
          "status-band px-4 py-3",
          claimed ? "status-band-ready motion-soft-scale-in" : "motion-status-pulse",
        ].join(" ")}
      >
        <p className="text-sm font-medium text-muted">Your parking spot</p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">
          {claimed ? "A driver is on the way" : "Waiting for a driver"}
        </h2>
        <p className="mt-2 text-sm text-foreground">
          {spot.address?.trim() ? spot.address : "Public street parking spot"}
        </p>
        <p className="mt-3 text-lg">
          <Countdown
            targetIso={spot.available_at}
            pendingLabel="Leaving in"
            readyLabel="Available now"
          />
        </p>
      </div>

      <p className="text-sm text-muted">
        Leave time: {formatDateTime(spot.available_at)}
      </p>

      <div className="pt-1">
        <CancelSpotButton spotId={spot.id} />
      </div>
    </Card>
  );
}
