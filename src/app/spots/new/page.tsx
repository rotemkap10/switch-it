import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";
import { PublishSpotForm } from "@/components/spots/PublishSpotForm";
import {
  PublisherSpotCard,
  type PublisherSpotSummary,
} from "@/components/spots/PublisherSpotCard";
import { Alert } from "@/components/ui/Alert";
import { requireUser } from "@/lib/auth/require-user";

type OwnedSpotRow = {
  id: string;
  status: string;
  available_at: string;
  address: string | null;
};

function toPublisherSpot(row: unknown): PublisherSpotSummary | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const spot = row as Partial<OwnedSpotRow>;
  if (
    typeof spot.id !== "string" ||
    typeof spot.available_at !== "string" ||
    (spot.status !== "available" && spot.status !== "claimed")
  ) {
    return null;
  }

  return {
    id: spot.id,
    status: spot.status,
    available_at: spot.available_at,
    address: typeof spot.address === "string" ? spot.address : null,
  };
}

export default async function NewSpotPage() {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("parking_spots")
    .select("id, status, available_at, address")
    .eq("owner_id", user.id)
    .in("status", ["available", "claimed"])
    .maybeSingle();

  const publisherSpot = error ? null : toPublisherSpot(data);

  return (
    <AuthenticatedShell
      title="Share my parking spot"
      description="Let nearby drivers know when this spot becomes available."
    >
      {error ? (
        <Alert tone="error">Could not load your parking spot.</Alert>
      ) : null}

      {publisherSpot ? (
        <PublisherSpotCard spot={publisherSpot} layout="page" />
      ) : (
        <PublishSpotForm />
      )}
    </AuthenticatedShell>
  );
}
