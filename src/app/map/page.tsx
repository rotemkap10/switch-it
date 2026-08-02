import Link from "next/link";

import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";
import { ParkingMapLoader } from "@/components/map/ParkingMapLoader";
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

export default async function MapPage() {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("parking_spots")
    .select(
      "id, latitude, longitude, address, available_at, expires_at, owner_id",
    )
    .eq("status", "available")
    .gt("expires_at", new Date().toISOString());

  const spots = error ? [] : toMapSpots(data, user.id);

  return (
    <AuthenticatedShell
      title="Map"
      description="Browse available public street parking handoffs near you."
    >
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          Could not load parking spots.
        </p>
      ) : null}

      {!error && spots.length === 0 ? (
        <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          <p>No available parking spots right now.</p>
          <p className="mt-1">
            <Link href="/spots/new" className="font-medium underline">
              Publish a spot
            </Link>{" "}
            or check back soon.
          </p>
        </div>
      ) : null}

      {!error ? <ParkingMapLoader spots={spots} /> : null}
    </AuthenticatedShell>
  );
}
