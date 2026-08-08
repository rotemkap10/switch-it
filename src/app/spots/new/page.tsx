import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";
import { VehicleSetupReminder } from "@/components/onboarding/VehicleSetupReminder";
import { PublishSpotForm } from "@/components/spots/PublishSpotForm";
import {
  PublisherSpotCard,
  type PublisherSpotSummary,
} from "@/components/spots/PublisherSpotCard";
import { PublisherRealtimeSync } from "@/components/spots/PublisherRealtimeSync";
import { Alert } from "@/components/ui/Alert";
import { requireAuthenticatedVehicleAccess } from "@/lib/auth/vehicle-access";
import { fetchHandoffCode } from "@/lib/handoff/fetch-handoff-code";
import { fetchHandoffCounterpartVehicle } from "@/lib/vehicle/fetch-handoff-counterpart-vehicle";
import { mapProfileVehicleToHandoff } from "@/lib/vehicle/handoff-vehicle";

type OwnedSpotRow = {
  id: string;
  status: string;
  available_at: string;
  expires_at: string;
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
    typeof spot.expires_at !== "string" ||
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
    expires_at: spot.expires_at,
    address: typeof spot.address === "string" ? spot.address : null,
    latitude: spot.latitude,
    longitude: spot.longitude,
  };
}

export default async function NewSpotPage() {
  const access = await requireAuthenticatedVehicleAccess({
    mode: "require-complete",
    handoffException: "active-publisher",
  });
  const { supabase, user } = access;
  const nowIso = new Date().toISOString();

  // Harden overdue open spots / claims before rendering.
  const { data: openSpot } = await supabase
    .from("parking_spots")
    .select("id, status, expires_at")
    .eq("owner_id", user.id)
    .in("status", ["available", "claimed"])
    .maybeSingle();

  if (
    openSpot &&
    typeof openSpot.id === "string" &&
    typeof openSpot.expires_at === "string" &&
    openSpot.expires_at <= nowIso
  ) {
    if (openSpot.status === "available") {
      await supabase.rpc("expire_spot_if_needed", { p_spot_id: openSpot.id });
    } else if (openSpot.status === "claimed") {
      const { data: claimOnSpot } = await supabase
        .from("claims")
        .select("id")
        .eq("spot_id", openSpot.id)
        .eq("status", "active")
        .maybeSingle();
      if (claimOnSpot && typeof claimOnSpot.id === "string") {
        await supabase.rpc("expire_claim_if_needed", {
          p_claim_id: claimOnSpot.id,
        });
      }
    }
  }

  const { data, error } = await supabase
    .from("parking_spots")
    .select("id, status, available_at, expires_at, address, latitude, longitude")
    .eq("owner_id", user.id)
    .in("status", ["available", "claimed"])
    .maybeSingle();

  const publisherSpot = error ? null : toPublisherSpot(data);

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select(
      "license_plate, vehicle_make, vehicle_model, vehicle_color, vehicle_type",
    )
    .eq("id", user.id)
    .maybeSingle();
  const ownVehicle = mapProfileVehicleToHandoff(ownProfile);

  let counterpartVehicle = null;
  let handoffCode: string | null = null;
  let activeClaimId: string | null = null;
  if (publisherSpot?.status === "claimed") {
    const { data: activeClaim } = await supabase
      .from("claims")
      .select("id")
      .eq("spot_id", publisherSpot.id)
      .eq("status", "active")
      .maybeSingle();

    if (activeClaim && typeof activeClaim.id === "string") {
      activeClaimId = activeClaim.id;
      [counterpartVehicle, handoffCode] = await Promise.all([
        fetchHandoffCounterpartVehicle(supabase, activeClaim.id),
        fetchHandoffCode(supabase, activeClaim.id),
      ]);
    }
  }

  return (
    <AuthenticatedShell
      title="Share a spot"
      description=""
      handoffException="active-publisher"
      access={access}
    >
      <PublisherRealtimeSync
        userId={user.id}
        spotId={publisherSpot?.id ?? null}
        claimId={activeClaimId}
      />
      <VehicleSetupReminder />
      {error ? (
        <Alert tone="error">Could not load your parking spot.</Alert>
      ) : null}

      {publisherSpot ? (
        <PublisherSpotCard
          spot={publisherSpot}
          layout="page"
          counterpartVehicle={counterpartVehicle}
          ownVehicle={ownVehicle}
          handoffCode={handoffCode}
          activeClaimId={activeClaimId}
        />
      ) : (
        <PublishSpotForm />
      )}
    </AuthenticatedShell>
  );
}
