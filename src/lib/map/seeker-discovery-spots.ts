import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import type { MapSpot } from "@/types/map-spot";

export const DISCOVERY_TOMBSTONE_TTL_MS = 15_000;

/**
 * claimed: temporarily hidden because someone holds the listing (may reopen).
 * terminal: cancelled / expired / completed (stale RSC must not resurrect).
 * self-released: this seeker voluntarily released — hide only for them.
 */
export type DiscoveryTombstoneReason = "claimed" | "terminal" | "self-released";

export type DiscoveryTombstone = {
  at: number;
  reason: DiscoveryTombstoneReason;
};

export type DiscoveryTombstones = Map<string, DiscoveryTombstone>;

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

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function asTimestampString(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  return null;
}

/** Product rule: seekers only see non-expired available spots. */
export function isSeekerVisibleParkingSpot(
  row: SpotRowLike,
  nowMs: number = Date.now(),
): boolean {
  if (row.status !== "available") {
    return false;
  }
  const expiresAtRaw = asTimestampString(row.expires_at);
  if (!expiresAtRaw) {
    return false;
  }
  const expiresAt = Date.parse(expiresAtRaw);
  return Number.isFinite(expiresAt) && expiresAt > nowMs;
}

export function mapSpotFromParkingRow(
  row: SpotRowLike,
  userId: string,
): MapSpot | null {
  const latitude = asFiniteNumber(row.latitude);
  const longitude = asFiniteNumber(row.longitude);
  const availableAt = asTimestampString(row.available_at);
  const expiresAt = asTimestampString(row.expires_at);

  if (
    typeof row.id !== "string" ||
    latitude == null ||
    longitude == null ||
    !availableAt ||
    !expiresAt ||
    typeof row.owner_id !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    latitude,
    longitude,
    address: typeof row.address === "string" ? row.address : null,
    available_at: availableAt,
    expires_at: expiresAt,
    canClaim: row.owner_id !== userId,
  };
}

function pruneTombstones(
  tombstones: DiscoveryTombstones,
  nowMs: number,
  releasedSpotIds: ReadonlySet<string>,
): DiscoveryTombstones {
  const next = new Map(tombstones);
  for (const [id, entry] of next) {
    if (entry.reason === "self-released") {
      if (
        !releasedSpotIds.has(id) &&
        nowMs - entry.at > DISCOVERY_TOMBSTONE_TTL_MS
      ) {
        next.delete(id);
      }
      continue;
    }
    if (nowMs - entry.at > DISCOVERY_TOMBSTONE_TTL_MS) {
      next.delete(id);
    }
  }
  return next;
}

function hideForReleasedSeeker(
  spotId: string,
  releasedSpotIds: ReadonlySet<string>,
  tombstones: DiscoveryTombstones,
): boolean {
  if (releasedSpotIds.has(spotId)) {
    return true;
  }
  return tombstones.get(spotId)?.reason === "self-released";
}

/**
 * Merge RSC/server discovery list with local tombstones.
 * A claimed-then-reopened listing is available again: if the server includes
 * it, that is canonical and a "claimed" tombstone must not hide it globally.
 * Terminal tombstones still block stale RSC resurrection of cancelled rows.
 * Self-released tombstones are per-user and survive an available listing.
 */
export function mergeServerDiscoverySpots(
  serverSpots: MapSpot[],
  tombstones: DiscoveryTombstones,
  nowMs: number = Date.now(),
  releasedSpotIds: ReadonlySet<string> = new Set(),
): { spots: MapSpot[]; tombstones: DiscoveryTombstones } {
  const pruned = pruneTombstones(tombstones, nowMs, releasedSpotIds);
  const serverIds = new Set(serverSpots.map((spot) => spot.id));

  for (const id of [...pruned.keys()]) {
    const entry = pruned.get(id);
    if (!entry) {
      continue;
    }
    if (entry.reason === "self-released") {
      continue;
    }
    if (!serverIds.has(id)) {
      pruned.delete(id);
      continue;
    }
    if (entry.reason === "claimed") {
      // Server still lists it as available → the listing reopened.
      pruned.delete(id);
    }
  }

  const spots = serverSpots.filter((spot) => {
    if (hideForReleasedSeeker(spot.id, releasedSpotIds, pruned)) {
      return false;
    }
    const entry = pruned.get(spot.id);
    return !entry || entry.reason === "claimed";
  });
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

function tombstoneReasonForStatus(status: string | null): DiscoveryTombstoneReason {
  if (status === "claimed") {
    return "claimed";
  }
  return "terminal";
}

/**
 * Canonical discovery reconciliation for one postgres_changes payload.
 * Visible available → upsert (unless this seeker released it); otherwise remove.
 */
export function applyParkingSpotRealtimeEvent(
  spots: MapSpot[],
  tombstones: DiscoveryTombstones,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  userId: string,
  nowMs: number = Date.now(),
  releasedSpotIds: ReadonlySet<string> = new Set(),
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

  let nextTombstones = pruneTombstones(tombstones, nowMs, releasedSpotIds);

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
    nextTombstones.set(spotId, { at: nowMs, reason: "terminal" });
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
    if (hideForReleasedSeeker(newRow.id, releasedSpotIds, nextTombstones)) {
      nextTombstones = new Map(nextTombstones);
      nextTombstones.set(newRow.id, { at: nowMs, reason: "self-released" });
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
  const existingSelf = nextTombstones.get(newRow.id)?.reason === "self-released";
  nextTombstones.set(newRow.id, {
    at: nowMs,
    reason: existingSelf ? "self-released" : tombstoneReasonForStatus(status),
  });
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

/** Explicit local remove (failed claim / this seeker's voluntary release). */
export function tombstoneDiscoverySpot(
  spots: MapSpot[],
  tombstones: DiscoveryTombstones,
  spotId: string,
  nowMs: number = Date.now(),
  reason: DiscoveryTombstoneReason = "claimed",
  releasedSpotIds: ReadonlySet<string> = new Set(),
): ApplyDiscoveryRealtimeResult {
  const nextTombstones = pruneTombstones(tombstones, nowMs, releasedSpotIds);
  nextTombstones.set(spotId, { at: nowMs, reason });
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

export function discoveryTombstoneReasonForClaimError(
  errorCode: string | undefined,
): DiscoveryTombstoneReason {
  if (errorCode === "ALREADY_RELEASED_THIS_SPOT") {
    return "self-released";
  }
  if (errorCode === "SPOT_UNAVAILABLE") {
    return "claimed";
  }
  return "terminal";
}
