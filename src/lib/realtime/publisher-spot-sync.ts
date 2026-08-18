import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import type { PublisherSpotSummary } from "@/components/spots/PublisherSpotCard";

export type PublisherClaimHint = {
  spotId: string;
  claimId: string | null;
  source: "spot-update" | "claim-insert" | "claim-update" | "mutation";
  promoteToClaimed?: boolean;
  handoffStartedAt?: string | null;
  expiresAt?: string | null;
  extensionUsedAt?: string | null;
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

function rowTimestamp(
  row: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  if (!row) {
    return null;
  }
  const value = row[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
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
    const next = payload.new as Record<string, unknown>;
    const handoffStartedAt = rowTimestamp(next, "handoff_started_at");
    const expiresAt = rowTimestamp(next, "expires_at");
    const extensionUsedAt = rowTimestamp(next, "handoff_extension_used_at");
    if (eventType !== "UPDATE") {
      return null;
    }
    if (status === "claimed") {
      return {
        spotId: expectedSpotId,
        claimId: null,
        source: "spot-update",
        promoteToClaimed: true,
        handoffStartedAt,
        expiresAt,
        extensionUsedAt,
      };
    }
    if (handoffStartedAt || extensionUsedAt) {
      return {
        spotId: expectedSpotId,
        claimId: null,
        source: "spot-update",
        promoteToClaimed: false,
        handoffStartedAt,
        expiresAt,
        extensionUsedAt,
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
        promoteToClaimed: true,
      };
    }
  }

  return null;
}

/**
 * Merge RSC publisher spot props with a local Realtime claim hint so stale
 * server props cannot keep the UI on "Waiting for a driver" after a claim,
 * or hide the live handoff after "I'm leaving now".
 */
export function mergePublisherSpotFromServer(
  serverSpot: PublisherSpotSummary,
  serverClaimId: string | null,
  claimHint: PublisherClaimHint | null,
): { spot: PublisherSpotSummary; activeClaimId: string | null } {
  let spot = serverSpot;
  let activeClaimId =
    serverSpot.status === "claimed" ? serverClaimId : null;

  if (claimHint && claimHint.spotId === serverSpot.id) {
    if (claimHint.promoteToClaimed !== false && serverSpot.status !== "claimed") {
      spot = { ...spot, status: "claimed" };
    }
    if (spot.status === "claimed" && !activeClaimId) {
      activeClaimId = claimHint.claimId ?? serverClaimId;
    }
    if (!spot.handoff_started_at && claimHint.handoffStartedAt) {
      spot = {
        ...spot,
        handoff_started_at: claimHint.handoffStartedAt,
        expires_at: claimHint.expiresAt ?? spot.expires_at,
      };
    } else if (
      claimHint.expiresAt &&
      claimHint.expiresAt !== spot.expires_at &&
      (claimHint.source === "mutation" || Boolean(spot.handoff_started_at))
    ) {
      spot = { ...spot, expires_at: claimHint.expiresAt };
    }
    if (!spot.handoff_extension_used_at && claimHint.extensionUsedAt) {
      spot = { ...spot, handoff_extension_used_at: claimHint.extensionUsedAt };
    }
  }

  if (spot.status === "claimed") {
    return {
      spot,
      activeClaimId: activeClaimId ?? claimHint?.claimId ?? null,
    };
  }

  return { spot, activeClaimId: null };
}
