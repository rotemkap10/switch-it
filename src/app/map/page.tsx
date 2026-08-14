import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";
import { type ActiveClaimSummary } from "@/components/map/ActiveClaimPanel";
import { MapRealtimeSync } from "@/components/map/MapRealtimeSync";
import { SeekerMapExperience } from "@/components/map/SeekerMapExperience";
import { requireAuthenticatedVehicleAccess } from "@/lib/auth/vehicle-access";
import type { requireUser } from "@/lib/auth/require-user";
import { fetchHandoffCounterpartVehicle } from "@/lib/vehicle/fetch-handoff-counterpart-vehicle";
import { mapProfileVehicleToHandoff } from "@/lib/vehicle/handoff-vehicle";
import type { MapSpot } from "@/types/map-spot";

type SpotRow = {
  id: string;
  latitude: number;
  longitude: number;
  address: string | null;
  available_at: string;
  expires_at: string;
  owner_id: string;
};

type ActiveClaimRow = {
  id: string;
  expires_at: string;
  claimed_at?: string;
  parking_spots:
    | {
        id?: string;
        address: string | null;
        available_at: string;
        expires_at: string;
        latitude: number;
        longitude: number;
      }
    | {
        id?: string;
        address: string | null;
        available_at: string;
        expires_at: string;
        latitude: number;
        longitude: number;
      }[]
    | null;
};

type OwnedSpotRow = {
  id: string;
  status: string;
  available_at: string;
  address: string | null;
};

type MapSupabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

function toMapSpots(rows: unknown, userId: string): MapSpot[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") {
      return [];
    }

    const spot = row as Partial<SpotRow>;

    if (
      typeof spot.id !== "string" ||
      typeof spot.latitude !== "number" ||
      typeof spot.longitude !== "number" ||
      typeof spot.available_at !== "string" ||
      typeof spot.expires_at !== "string" ||
      typeof spot.owner_id !== "string"
    ) {
      return [];
    }

    return [
      {
        id: spot.id,
        latitude: spot.latitude,
        longitude: spot.longitude,
        address: spot.address ?? null,
        available_at: spot.available_at,
        expires_at: spot.expires_at,
        canClaim: spot.owner_id !== userId,
      },
    ];
  });
}

function toActiveClaim(row: unknown): ActiveClaimSummary | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const claim = row as Partial<ActiveClaimRow>;
  if (typeof claim.id !== "string" || typeof claim.expires_at !== "string") {
    return null;
  }

  const spotRelation = Array.isArray(claim.parking_spots)
    ? claim.parking_spots[0]
    : claim.parking_spots;

  const spotAvailableAt =
    spotRelation && typeof spotRelation.available_at === "string"
      ? spotRelation.available_at
      : typeof claim.claimed_at === "string"
        ? claim.claimed_at
        : null;
  const spotExpiresAt =
    spotRelation && typeof spotRelation.expires_at === "string"
      ? spotRelation.expires_at
      : claim.expires_at;

  if (!spotAvailableAt) {
    return null;
  }

  return {
    claimId: claim.id,
    spotId:
      spotRelation && typeof spotRelation.id === "string"
        ? spotRelation.id
        : null,
    claimExpiresAt: claim.expires_at,
    spotAvailableAt,
    spotExpiresAt,
    spotAddress:
      spotRelation && typeof spotRelation.address === "string"
        ? spotRelation.address
        : null,
  };
}

type DestinationCoords = { latitude: number; longitude: number };

function toActiveClaimDestination(row: unknown): DestinationCoords | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const claim = row as Partial<ActiveClaimRow>;
  const spotRelation = Array.isArray(claim.parking_spots)
    ? claim.parking_spots[0]
    : claim.parking_spots;

  if (
    !spotRelation ||
    typeof spotRelation.latitude !== "number" ||
    typeof spotRelation.longitude !== "number"
  ) {
    return null;
  }

  return {
    latitude: spotRelation.latitude,
    longitude: spotRelation.longitude,
  };
}

function hasOpenOwnedSpot(row: unknown): boolean {
  if (!row || typeof row !== "object") {
    return false;
  }

  const spot = row as Partial<OwnedSpotRow>;
  return (
    typeof spot.id === "string" &&
    (spot.status === "available" || spot.status === "claimed")
  );
}

function isPastDue(expiresAt: string, nowIso: string): boolean {
  return expiresAt <= nowIso;
}

async function expireDueClaims(
  supabase: MapSupabase,
  userId: string,
  nowIso: string,
): Promise<void> {
  const [seekerClaimResult, ownedClaimedSpotResult, ownedAvailableSpotResult] =
    await Promise.all([
      supabase
        .from("claims")
        .select("id, expires_at")
        .eq("seeker_id", userId)
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("parking_spots")
        .select("id")
        .eq("owner_id", userId)
        .eq("status", "claimed")
        .maybeSingle(),
      supabase
        .from("parking_spots")
        .select("id, expires_at")
        .eq("owner_id", userId)
        .eq("status", "available")
        .maybeSingle(),
    ]);

  const claimIds = new Set<string>();

  const seekerClaim = seekerClaimResult.data;
  if (
    seekerClaim &&
    typeof seekerClaim.id === "string" &&
    typeof seekerClaim.expires_at === "string" &&
    isPastDue(seekerClaim.expires_at, nowIso)
  ) {
    claimIds.add(seekerClaim.id);
  }

  const ownedClaimedSpot = ownedClaimedSpotResult.data;
  if (ownedClaimedSpot && typeof ownedClaimedSpot.id === "string") {
    const { data: claimOnSpot } = await supabase
      .from("claims")
      .select("id, expires_at")
      .eq("spot_id", ownedClaimedSpot.id)
      .eq("status", "active")
      .maybeSingle();

    if (
      claimOnSpot &&
      typeof claimOnSpot.id === "string" &&
      typeof claimOnSpot.expires_at === "string" &&
      isPastDue(claimOnSpot.expires_at, nowIso)
    ) {
      claimIds.add(claimOnSpot.id);
    }
  }

  for (const claimId of claimIds) {
    await supabase.rpc("expire_claim_if_needed", { p_claim_id: claimId });
  }

  const ownedAvailable = ownedAvailableSpotResult.data;
  if (
    ownedAvailable &&
    typeof ownedAvailable.id === "string" &&
    typeof ownedAvailable.expires_at === "string" &&
    isPastDue(ownedAvailable.expires_at, nowIso)
  ) {
    await supabase.rpc("expire_spot_if_needed", {
      p_spot_id: ownedAvailable.id,
    });
  }
}

export default async function MapPage() {
  const access = await requireAuthenticatedVehicleAccess({
    mode: "require-complete",
    handoffException: "active-seeker",
  });
  const { supabase, user } = access;
  const nowIso = new Date().toISOString();

  await expireDueClaims(supabase, user.id, nowIso);

  const [spotsResult, activeClaimResult, ownedSpotResult] = await Promise.all([
    supabase
      .from("parking_spots")
      .select(
        "id, latitude, longitude, address, available_at, expires_at, owner_id",
      )
      .eq("status", "available")
      .gt("expires_at", new Date().toISOString()),
    supabase
      .from("claims")
      .select(
        "id, expires_at, claimed_at, parking_spots(id, address, available_at, expires_at, latitude, longitude)",
      )
      .eq("seeker_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("parking_spots")
      .select("id, status, available_at, address")
      .eq("owner_id", user.id)
      .in("status", ["available", "claimed"])
      .maybeSingle(),
  ]);

  const spots = spotsResult.error
    ? []
    : toMapSpots(spotsResult.data, user.id);
  const activeClaim = activeClaimResult.error
    ? null
    : toActiveClaim(activeClaimResult.data);

  const activeClaimDestination = activeClaimResult.error
    ? null
    : toActiveClaimDestination(activeClaimResult.data);
  const showOwnSpotNotice =
    !ownedSpotResult.error && hasOpenOwnedSpot(ownedSpotResult.data);

  const counterpartVehicle =
    activeClaim?.claimId != null
      ? await fetchHandoffCounterpartVehicle(supabase, activeClaim.claimId)
      : null;

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select(
      "license_plate, vehicle_make, vehicle_model, vehicle_color, vehicle_type",
    )
    .eq("id", user.id)
    .maybeSingle();
  const ownVehicle = mapProfileVehicleToHandoff(ownProfile);

  return (
    <AuthenticatedShell
      layout="map"
      title="Find parking"
      description="Choose a spot nearby."
      handoffException="active-seeker"
      access={access}
    >
      <MapRealtimeSync
        userId={user.id}
        activeClaimId={activeClaim?.claimId ?? null}
      />
      <SeekerMapExperience
        spots={spots}
        destination={activeClaimDestination}
        activeClaim={activeClaim}
        counterpartVehicle={counterpartVehicle}
        ownVehicle={ownVehicle}
        showOwnSpotNotice={showOwnSpotNotice}
        spotsError={Boolean(spotsResult.error)}
        activeClaimError={Boolean(activeClaimResult.error)}
        ownedSpotError={Boolean(ownedSpotResult.error)}
      />
    </AuthenticatedShell>
  );
}
