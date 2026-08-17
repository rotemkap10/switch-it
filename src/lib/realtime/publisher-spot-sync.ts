import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import type { PublisherSpotSummary } from "@/components/spots/PublisherSpotCard";

export type PublisherClaimHint = {
  spotId: string;
  claimId: string | null;
  source: "spot-update" | "claim-insert" | "claim-update";
};

function rowStatus(
  row: Record<string, unknown> | null | undefined,
): string | null {
  if (!row || typeof row.status !== "string") {
    return null;
  }
  return row.status;
}

function rowId(row: Record<string, unknown> | null | undefined): string | null {
  if (!row || typeof row.id !== "string") {
    return null;
  }
  return row.id;
}

function rowSpotId(
  row: Record<string, unknown> | null | undefined,
): string | null {
  if (!row || typeof row.spot_id !== "string") {
    return null;
  }
  return row.spot_id;
}

/**
 * Derive a local claimed hint from parking_spots or claims Realtime payloads.
 */
export function publisherClaimHintFromPayload(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  expectedSpotId: string,
): PublisherClaimHint | null {
  const table = payload.table;
  const eventType = payload.eventType;

  if (table === "parking_spots") {
    const spotId =
      rowId(payload.new as Record<string, unknown>) ??
      rowId(payload.old as Record<string, unknown>);
    if (spotId !== expectedSpotId) {
      return null;
    }
    const status = rowStatus(payload.new as Record<string, unknown>);
    if (eventType === "UPDATE" && status === "claimed") {
      return {
        spotId: expectedSpotId,
        claimId: null,
        source: "spot-update",
      };
    }
    return null;
  }

  if (table === "claims") {
    const spotId =
      rowSpotId(payload.new as Record<string, unknown>) ??
      rowSpotId(payload.old as Record<string, unknown>);
    if (spotId !== expectedSpotId) {
      return null;
    }
    const status = rowStatus(payload.new as Record<string, unknown>);
    const claimId =
      rowId(payload.new as Record<string, unknown>) ??
      rowId(payload.old as Record<string, unknown>);

    if (
      (eventType === "INSERT" || eventType === "UPDATE") &&
      status === "active"
    ) {
      return {
        spotId: expectedSpotId,
        claimId,
        source: eventType === "INSERT" ? "claim-insert" : "claim-update",
      };
    }
  }

  return null;
}

/**
 * Merge RSC publisher spot props with a local Realtime claim hint so stale
 * server props cannot keep the UI on "Waiting for a driver" after a claim.
 */
export function mergePublisherSpotFromServer(
  serverSpot: PublisherSpotSummary,
  serverClaimId: string | null,
  claimHint: PublisherClaimHint | null,
): { spot: PublisherSpotSummary; activeClaimId: string | null } {
  if (serverSpot.status === "claimed") {
    return {
      spot: serverSpot,
      activeClaimId: serverClaimId ?? claimHint?.claimId ?? null,
    };
  }

  if (claimHint && claimHint.spotId === serverSpot.id) {
    return {
      spot: { ...serverSpot, status: "claimed" },
      activeClaimId: claimHint.claimId ?? serverClaimId,
    };
  }

  return { spot: serverSpot, activeClaimId: null };
}
