import Link from "next/link";

import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";
import {
  ActiveClaimPanel,
  type ActiveClaimSummary,
} from "@/components/map/ActiveClaimPanel";
import { OwnSpotNotice } from "@/components/map/OwnSpotNotice";
import { ParkingMapLoader } from "@/components/map/ParkingMapLoader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth/require-user";
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
  parking_spots:
    | {
        address: string | null;
        available_at: string;
      }
    | {
        address: string | null;
        available_at: string;
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

  if (!spotRelation || typeof spotRelation.available_at !== "string") {
    return null;
  }

  return {
    claimId: claim.id,
    claimExpiresAt: claim.expires_at,
    spotAvailableAt: spotRelation.available_at,
    spotAddress:
      typeof spotRelation.address === "string" ? spotRelation.address : null,
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
  const [seekerClaimResult, ownedClaimedSpotResult] = await Promise.all([
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
}

export default async function MapPage() {
  const { supabase, user } = await requireUser();
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
      .select("id, expires_at, parking_spots(address, available_at)")
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
  const showOwnSpotNotice =
    !ownedSpotResult.error && hasOpenOwnedSpot(ownedSpotResult.data);

  return (
    <AuthenticatedShell
      title="Find parking"
      description="Pick a spot nearby and head over before the hold expires."
    >
      {spotsResult.error ? (
        <Alert tone="error">Could not load parking spots.</Alert>
      ) : null}

      {activeClaimResult.error ? (
        <Alert tone="error">Could not load your active trip.</Alert>
      ) : null}

      {ownedSpotResult.error ? (
        <Alert tone="error">Could not check your published spot.</Alert>
      ) : null}

      {activeClaim ? <ActiveClaimPanel claim={activeClaim} /> : null}

      {showOwnSpotNotice ? <OwnSpotNotice /> : null}

      {!spotsResult.error && spots.length === 0 ? (
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-foreground">
              No parking spots right now
            </p>
            <p className="mt-1 text-sm text-muted">
              Check back soon, or share a spot you are leaving.
            </p>
          </div>
          <Link href="/spots/new">
            <Button variant="secondary">Share my parking spot</Button>
          </Link>
        </Card>
      ) : null}

      {!spotsResult.error ? (
        <Card className="overflow-hidden p-0">
          <ParkingMapLoader spots={spots} />
        </Card>
      ) : null}
    </AuthenticatedShell>
  );
}
