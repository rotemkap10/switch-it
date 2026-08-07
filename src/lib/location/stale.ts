import {
  LIVE_LOCATION_STALE_DELAYED_MS,
  LIVE_LOCATION_STALE_LIVE_MS,
} from "@/lib/location/constants";

export type LiveLocationFreshness =
  | "waiting"
  | "live"
  | "delayed"
  | "paused";

export function liveLocationFreshness(
  lastReceivedAtMs: number | null,
  nowMs: number = Date.now(),
): LiveLocationFreshness {
  if (lastReceivedAtMs === null) {
    return "waiting";
  }
  const age = nowMs - lastReceivedAtMs;
  if (age <= LIVE_LOCATION_STALE_LIVE_MS) {
    return "live";
  }
  if (age <= LIVE_LOCATION_STALE_DELAYED_MS) {
    return "delayed";
  }
  return "paused";
}

export function liveLocationStatusLabel(
  freshness: LiveLocationFreshness,
): string {
  switch (freshness) {
    case "waiting":
      return "Waiting for live location";
    case "live":
      return "Live location";
    case "delayed":
      return "Location may be delayed";
    case "paused":
      return "Live location paused";
  }
}

/** Coarse relative age — no sub-second precision. */
export function liveLocationUpdatedLabel(
  freshness: LiveLocationFreshness,
  lastReceivedAtMs: number | null,
  nowMs: number = Date.now(),
): string {
  if (freshness === "waiting" || lastReceivedAtMs === null) {
    return "The driver can choose to share their progress.";
  }
  if (freshness === "live") {
    return "Updated just now";
  }
  const seconds = Math.max(1, Math.round((nowMs - lastReceivedAtMs) / 1000));
  if (freshness === "delayed") {
    return `Updated ${seconds} seconds ago`;
  }
  return `Last updated ${seconds} seconds ago`;
}
