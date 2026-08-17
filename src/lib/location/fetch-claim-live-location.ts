import type { SupabaseClient } from "@supabase/supabase-js";

import { parseSeekerLocationPayload } from "@/lib/location/payload";

export type ClaimLiveLocationRow = {
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  heading_degrees: number | null;
  sequence: number;
  location_timestamp: string;
};

export function claimLiveLocationRowToPayload(
  row: ClaimLiveLocationRow,
  nowMs: number = Date.now(),
) {
  const sentAt = Date.parse(row.location_timestamp);
  if (!Number.isFinite(sentAt)) {
    return null;
  }

  return parseSeekerLocationPayload(
    {
      latitude: row.latitude,
      longitude: row.longitude,
      accuracyMeters: row.accuracy_meters,
      headingDegrees: row.heading_degrees,
      sequence: row.sequence,
      sentAt,
    },
    nowMs,
  );
}

/** Fetch the latest authorized snapshot for one claim (publisher/seeker RLS). */
export async function fetchLatestClaimLiveLocation(
  client: SupabaseClient,
  claimId: string,
): Promise<ReturnType<typeof claimLiveLocationRowToPayload>> {
  const { data, error } = await client
    .from("claim_live_locations")
    .select(
      "latitude, longitude, accuracy_meters, heading_degrees, sequence, location_timestamp",
    )
    .eq("claim_id", claimId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return claimLiveLocationRowToPayload(data as ClaimLiveLocationRow);
}
