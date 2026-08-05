import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";
import { VehicleSetupReminder } from "@/components/onboarding/VehicleSetupReminder";
import { PublishSpotForm } from "@/components/spots/PublishSpotForm";
import {
  PublisherSpotCard,
  type PublisherSpotSummary,
} from "@/components/spots/PublisherSpotCard";
import { Alert } from "@/components/ui/Alert";
import { requireUser } from "@/lib/auth/require-user";
import { fetchHandoffCode } from "@/lib/handoff/fetch-handoff-code";
import { fetchHandoffCounterpartVehicle } from "@/lib/vehicle/fetch-handoff-counterpart-vehicle";

type OwnedSpotRow = {
  id: string;
  status: string;
  available_at: string;
  address: string | null;
  latitude: number;
  longitude: number;
};

function toPublisherSpot(row: unknown): PublisherSpotSummary | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const spot = row as Partial<OwnedSpotRow>;
  if (
    typeof spot.id !== "string" ||
    typeof spot.available_at !== "string" ||
    typeof spot.latitude !== "number" ||
    typeof spot.longitude !== "number" ||
    !Number.isFinite(spot.latitude) ||
    !Number.isFinite(spot.longitude) ||
    (spot.status !== "available" && spot.status !== "claimed")
  ) {
    return null;
  }

  return {
    id: spot.id,
    status: spot.status,
    available_at: spot.available_at,
    address: typeof spot.address === "string" ? spot.address : null,
    latitude: spot.latitude,
    longitude: spot.longitude,
  };
}

export default async function NewSpotPage() {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("parking_spots")
    .select("id, status, available_at, address, latitude, longitude")
    .eq("owner_id", user.id)
    .in("status", ["available", "claimed"])
    .maybeSingle();

  const publisherSpot = error ? null : toPublisherSpot(data);

  let counterpartVehicle = null;
  let handoffCode: string | null = null;
  if (publisherSpot?.status === "claimed") {
    const { data: activeClaim } = await supabase
      .from("claims")
      .select("id")
      .eq("spot_id", publisherSpot.id)
      .eq("status", "active")
      .maybeSingle();

    if (activeClaim && typeof activeClaim.id === "string") {
      [counterpartVehicle, handoffCode] = await Promise.all([
        fetchHandoffCounterpartVehicle(supabase, activeClaim.id),
        fetchHandoffCode(supabase, activeClaim.id),
      ]);
    }
  }

  return (
    <AuthenticatedShell
      title="Share my parking spot"
      description="Let nearby drivers know when this spot becomes available."
      handoffException="active-publisher"
    >
      <VehicleSetupReminder />
      {error ? (
        <Alert tone="error">Could not load your parking spot.</Alert>
      ) : null}

      {publisherSpot ? (
        <PublisherSpotCard
          spot={publisherSpot}
          layout="page"
          counterpartVehicle={counterpartVehicle}
          handoffCode={handoffCode}
        />
      ) : (
        <PublishSpotForm />
      )}
    </AuthenticatedShell>
  );
}
