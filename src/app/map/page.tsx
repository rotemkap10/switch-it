import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";
import { type ActiveClaimSummary } from "@/components/map/ActiveClaimPanel";
import { MapRealtimeSync } from "@/components/map/MapRealtimeSync";
import { SeekerMapExperience } from "@/components/map/SeekerMapExperience";
import { requireAuthenticatedVehicleAccess } from "@/lib/auth/vehicle-access";
import type { requireUser } from "@/lib/auth/require-user";
import { runRscQuery } from "@/lib/server/rsc-recovery";
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
        handoff_started_at?: string | null;
        latitude: number;
        longitude: number;
      }
    | {
        id?: string;
        address: string | null;
        available_at: string;
        expires_at: string;
        handoff_started_at?: string | null;
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
    handoffStartedAt:
      spotRelation && typeof spotRelation.handoff_started_at === "string"
        ? spotRelation.handoff_started_at
        : null,
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

async function expireDueClaims(
  supabase: MapSupabase,
  userId: string,
): Promise<void> {
  await runRscQuery(
    "expire_due_map_claims",
    async () => {
      const [seekerClaimResult, ownedClaimedSpotResult, ownedAvailableSpotResult] =
        await Promise.all([
          supabase
            .from("claims")
            .select("id")
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
            .select("id")
            .eq("owner_id", userId)
            .eq("status", "available")
            .maybeSingle(),
        ]);

      const claimIds = new Set<string>();

      const seekerClaim = seekerClaimResult.data;
      if (seekerClaim && typeof seekerClaim.id === "string") {
        claimIds.add(seekerClaim.id);
      }

      const ownedClaimedSpot = ownedClaimedSpotResult.data;
      if (ownedClaimedSpot && typeof ownedClaimedSpot.id === "string") {
        const { data: claimOnSpot } = await supabase
          .from("claims")
          .select("id")
          .eq("spot_id", ownedClaimedSpot.id)
          .eq("status", "active")
          .maybeSingle();

        if (claimOnSpot && typeof claimOnSpot.id === "string") {
          claimIds.add(claimOnSpot.id);
        }
      }

      for (const claimId of claimIds) {
        await supabase.rpc("expire_claim_if_needed", { p_claim_id: claimId });
      }

      const ownedAvailable = ownedAvailableSpotResult.data;
      if (ownedAvailable && typeof ownedAvailable.id === "string") {
        await supabase.rpc("expire_spot_if_needed", {
          p_spot_id: ownedAvailable.id,
        });
      }
    },
    undefined,
    { route: "/map" },
  );
}

export default async function MapPage() {
  const access = await requireAuthenticatedVehicleAccess({
    mode: "require-complete",
    handoffException: "active-seeker",
  });
  const { supabase, user } = access;
  await expireDueClaims(supabase, user.id);

  const mapState = await runRscQuery(
    "load_map_handoff_state",
    async () => {
      const [spotsResult, activeClaimResult, ownedSpotResult] = await Promise.all(
        [
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
              "id, expires_at, claimed_at, parking_spots(id, address, available_at, expires_at, handoff_started_at, latitude, longitude)",
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
        ],
      );
      return { spotsResult, activeClaimResult, ownedSpotResult };
    },
    null,
    { route: "/map" },
  );

  const spotsResult = mapState?.spotsResult;
  const activeClaimResult = mapState?.activeClaimResult;
  const ownedSpotResult = mapState?.ownedSpotResult;

  const spots =
    !spotsResult || spotsResult.error
      ? []
      : toMapSpots(spotsResult.data, user.id);
  const activeClaim =
    !activeClaimResult || activeClaimResult.error
      ? null
      : toActiveClaim(activeClaimResult.data);

  const activeClaimDestination =
    !activeClaimResult || activeClaimResult.error
      ? null
      : toActiveClaimDestination(activeClaimResult.data);
  const showOwnSpotNotice = Boolean(
    ownedSpotResult &&
      !ownedSpotResult.error &&
      hasOpenOwnedSpot(ownedSpotResult.data),
  );

  const counterpartVehicle =
    activeClaim?.claimId != null
      ? await fetchHandoffCounterpartVehicle(supabase, activeClaim.claimId)
      : null;

  const ownVehicle = await runRscQuery(
    "load_seeker_own_vehicle",
    async () => {
      const { data: ownProfile } = await supabase
        .from("profiles")
        .select(
          "license_plate, vehicle_make, vehicle_model, vehicle_year, vehicle_color, vehicle_type",
        )
        .eq("id", user.id)
        .maybeSingle();
      return mapProfileVehicleToHandoff(ownProfile);
    },
    null,
    { route: "/map" },
  );

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
        userId={user.id}
        destination={activeClaimDestination}
        activeClaim={activeClaim}
        counterpartVehicle={counterpartVehicle}
        ownVehicle={ownVehicle}
        showOwnSpotNotice={showOwnSpotNotice}
        spotsError={Boolean(!spotsResult || spotsResult.error)}
        activeClaimError={Boolean(!activeClaimResult || activeClaimResult.error)}
        ownedSpotError={Boolean(!ownedSpotResult || ownedSpotResult.error)}
      />
    </AuthenticatedShell>
  );
}
