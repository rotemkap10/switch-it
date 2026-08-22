import type { SupabaseClient } from "@supabase/supabase-js";

import { logHandoffLiveReceiver } from "@/lib/location/log-handoff-live-receiver";
import { parseSeekerLocationPayload } from "@/lib/location/payload";
import { normalizeClaimIdForTopic } from "@/lib/location/topic";

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
  const normalizedClaimId = normalizeClaimIdForTopic(claimId);
  if (!normalizedClaimId) {
    return null;
  }
  try {
    const { data, error } = await client
      .from("claim_live_locations")
      .select(
        "latitude, longitude, accuracy_meters, heading_degrees, sequence, location_timestamp",
      )
      .eq("claim_id", normalizedClaimId)
      .maybeSingle();

    if (error) {
      logHandoffLiveReceiver("snapshot fetch failed", {
        claimId: normalizedClaimId,
        code: error.code ?? null,
        message: error.message,
      });
      return null;
    }

    if (!data) {
      return null;
    }

    return claimLiveLocationRowToPayload(data as ClaimLiveLocationRow);
  } catch {
    return null;
  }
}
