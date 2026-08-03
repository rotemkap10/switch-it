import Link from "next/link";

import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";
import {
  ActiveClaimPanel,
  type ActiveClaimSummary,
} from "@/components/map/ActiveClaimPanel";
import { ParkingMapLoader } from "@/components/map/ParkingMapLoader";
import {
  PublisherSpotCard,
  type PublisherSpotSummary,
} from "@/components/spots/PublisherSpotCard";
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

  if (
    !spotRelation ||
    typeof spotRelation.available_at !== "string"
  ) {
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

export default async function MapPage() {
  const { supabase, user } = await requireUser();

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
  const publisherSpot = ownedSpotResult.error
    ? null
    : toPublisherSpot(ownedSpotResult.data);

  return (
    <AuthenticatedShell
      title="Map"
      description="Browse available public street parking handoffs near you."
    >
      {spotsResult.error ? (
        <Alert tone="error">Could not load parking spots.</Alert>
      ) : null}

      {activeClaimResult.error ? (
        <Alert tone="error">Could not load your active claim.</Alert>
      ) : null}

      {ownedSpotResult.error ? (
        <Alert tone="error">Could not load your published spot.</Alert>
      ) : null}

      {activeClaim ? <ActiveClaimPanel claim={activeClaim} /> : null}

      {!spotsResult.error && spots.length === 0 ? (
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-foreground">
              No available parking spots right now
            </p>
            <p className="mt-1 text-sm text-muted">
              Publish a spot you are leaving, or check back soon.
            </p>
          </div>
          <Link href="/spots/new">
            <Button>Publish a spot</Button>
          </Link>
        </Card>
      ) : null}

      {!spotsResult.error ? (
        <Card className="overflow-hidden p-0">
          <ParkingMapLoader spots={spots} />
        </Card>
      ) : null}

      {publisherSpot ? <PublisherSpotCard spot={publisherSpot} /> : null}
    </AuthenticatedShell>
  );
}
