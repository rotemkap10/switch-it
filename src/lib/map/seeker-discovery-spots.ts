import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import type { MapSpot } from "@/types/map-spot";

export const DISCOVERY_TOMBSTONE_TTL_MS = 15_000;

export type DiscoveryTombstones = Map<string, number>;

type SpotRowLike = {
  id?: unknown;
  status?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  address?: unknown;
  available_at?: unknown;
  expires_at?: unknown;
  owner_id?: unknown;
};

export function logSpotsRealtime(
  message: string,
  detail?: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  if (detail) {
    console.info(`[switch-it:spots-realtime] ${message}`, detail);
    return;
  }
  console.info(`[switch-it:spots-realtime] ${message}`);
}

/** Product rule: seekers only see non-expired available spots. */
export function isSeekerVisibleParkingSpot(
  row: SpotRowLike,
  nowMs: number = Date.now(),
): boolean {
  if (row.status !== "available") {
    return false;
  }
  if (typeof row.expires_at !== "string") {
    return false;
  }
  const expiresAt = Date.parse(row.expires_at);
  return Number.isFinite(expiresAt) && expiresAt > nowMs;
}

export function mapSpotFromParkingRow(
  row: SpotRowLike,
  userId: string,
): MapSpot | null {
  if (
    typeof row.id !== "string" ||
    typeof row.latitude !== "number" ||
    typeof row.longitude !== "number" ||
    typeof row.available_at !== "string" ||
    typeof row.expires_at !== "string" ||
    typeof row.owner_id !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    address: typeof row.address === "string" ? row.address : null,
    available_at: row.available_at,
    expires_at: row.expires_at,
    canClaim: row.owner_id !== userId,
  };
}

function pruneTombstones(
  tombstones: DiscoveryTombstones,
  nowMs: number,
): DiscoveryTombstones {
  const next = new Map(tombstones);
  for (const [id, at] of next) {
    if (nowMs - at > DISCOVERY_TOMBSTONE_TTL_MS) {
      next.delete(id);
    }
  }
  return next;
}

/**
 * Merge RSC/server discovery list with local tombstones so a stale fetch
 * cannot resurrect a spot realtime already removed.
 */
export function mergeServerDiscoverySpots(
  serverSpots: MapSpot[],
  tombstones: DiscoveryTombstones,
  nowMs: number = Date.now(),
): { spots: MapSpot[]; tombstones: DiscoveryTombstones } {
  const pruned = pruneTombstones(tombstones, nowMs);
  const serverIds = new Set(serverSpots.map((spot) => spot.id));

  for (const id of [...pruned.keys()]) {
    if (!serverIds.has(id)) {
      pruned.delete(id);
    }
  }

  const spots = serverSpots.filter((spot) => !pruned.has(spot.id));
  return { spots, tombstones: pruned };
}

function upsertSpot(spots: MapSpot[], spot: MapSpot): MapSpot[] {
  const index = spots.findIndex((item) => item.id === spot.id);
  if (index === -1) {
    return [...spots, spot];
  }
  const next = spots.slice();
  next[index] = spot;
  return next;
}

function removeSpot(spots: MapSpot[], spotId: string): MapSpot[] {
  if (!spots.some((spot) => spot.id === spotId)) {
    return spots;
  }
  return spots.filter((spot) => spot.id !== spotId);
}

export type ApplyDiscoveryRealtimeResult = {
  spots: MapSpot[];
  tombstones: DiscoveryTombstones;
  changed: boolean;
  action: "upsert" | "remove" | "ignore";
  spotId: string | null;
  status: string | null;
};

/**
 * Canonical discovery reconciliation for one postgres_changes payload.
 * Visible available → upsert; otherwise remove by id.
 */
export function applyParkingSpotRealtimeEvent(
  spots: MapSpot[],
  tombstones: DiscoveryTombstones,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  userId: string,
  nowMs: number = Date.now(),
): ApplyDiscoveryRealtimeResult {
  const eventType = payload.eventType;
  const newRow = (payload.new ?? null) as SpotRowLike | null;
  const oldRow = (payload.old ?? null) as SpotRowLike | null;
  const spotId =
    (typeof newRow?.id === "string" && newRow.id) ||
    (typeof oldRow?.id === "string" && oldRow.id) ||
    null;
  const status =
    typeof newRow?.status === "string"
      ? newRow.status
      : typeof oldRow?.status === "string"
        ? oldRow.status
        : null;

  let nextTombstones = pruneTombstones(tombstones, nowMs);

  if (eventType === "DELETE") {
    if (!spotId) {
      return {
        spots,
        tombstones: nextTombstones,
        changed: false,
        action: "ignore",
        spotId,
        status,
      };
    }
    nextTombstones = new Map(nextTombstones);
    nextTombstones.set(spotId, nowMs);
    const nextSpots = removeSpot(spots, spotId);
    return {
      spots: nextSpots,
      tombstones: nextTombstones,
      changed: nextSpots !== spots,
      action: "remove",
      spotId,
      status,
    };
  }

  if (eventType !== "INSERT" && eventType !== "UPDATE") {
    return {
      spots,
      tombstones: nextTombstones,
      changed: false,
      action: "ignore",
      spotId,
      status,
    };
  }

  if (!newRow || typeof newRow.id !== "string") {
    return {
      spots,
      tombstones: nextTombstones,
      changed: false,
      action: "ignore",
      spotId,
      status,
    };
  }

  if (isSeekerVisibleParkingSpot(newRow, nowMs)) {
    const mapped = mapSpotFromParkingRow(newRow, userId);
    if (!mapped) {
      return {
        spots,
        tombstones: nextTombstones,
        changed: false,
        action: "ignore",
        spotId: newRow.id,
        status,
      };
    }
    nextTombstones = new Map(nextTombstones);
    nextTombstones.delete(mapped.id);
    const nextSpots = upsertSpot(spots, mapped);
    return {
      spots: nextSpots,
      tombstones: nextTombstones,
      changed: true,
      action: "upsert",
      spotId: mapped.id,
      status,
    };
  }

  nextTombstones = new Map(nextTombstones);
  nextTombstones.set(newRow.id, nowMs);
  const nextSpots = removeSpot(spots, newRow.id);
  return {
    spots: nextSpots,
    tombstones: nextTombstones,
    changed: nextSpots !== spots || !tombstones.has(newRow.id),
    action: "remove",
    spotId: newRow.id,
    status,
  };
}

/** Explicit local remove (e.g. failed claim on a just-cancelled spot). */
export function tombstoneDiscoverySpot(
  spots: MapSpot[],
  tombstones: DiscoveryTombstones,
  spotId: string,
  nowMs: number = Date.now(),
): ApplyDiscoveryRealtimeResult {
  const nextTombstones = pruneTombstones(tombstones, nowMs);
  nextTombstones.set(spotId, nowMs);
  const nextSpots = removeSpot(spots, spotId);
  return {
    spots: nextSpots,
    tombstones: nextTombstones,
    changed: nextSpots !== spots || !tombstones.has(spotId),
    action: "remove",
    spotId,
    status: null,
  };
}
