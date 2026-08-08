import {
  LIVE_LOCATION_STALE_DELAYED_MS,
  LIVE_LOCATION_STALE_LIVE_MS,
} from "@/lib/location/constants";

export type LiveLocationFreshness =
  | "waiting"
  | "live"
  | "delayed"
  | "paused"
  | "unavailable";

export const LIVE_LOCATION_PAUSE_WHILE_NAVIGATING =
  "Live location paused while the driver is navigating";

export function liveLocationFreshness(
  lastReceivedAtMs: number | null,
  nowMs: number = Date.now(),
): Exclude<LiveLocationFreshness, "unavailable"> {
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
      return "Waiting for driver location";
    case "live":
      return "Driver location live";
    case "delayed":
      return "Location update delayed";
    case "paused":
      return "Live location paused";
    case "unavailable":
      return "Live location temporarily unavailable";
  }
}

/** Coarse relative age — no sub-second precision. */
export function liveLocationUpdatedLabel(
  freshness: Exclude<LiveLocationFreshness, "unavailable">,
  lastReceivedAtMs: number | null,
  nowMs: number = Date.now(),
): string {
  if (freshness === "waiting" || lastReceivedAtMs === null) {
    return "Waiting";
  }
  if (freshness === "live") {
    return "Updated just now";
  }
  const seconds = Math.max(1, Math.round((nowMs - lastReceivedAtMs) / 1000));
  if (freshness === "delayed") {
    return `Updated ${seconds} seconds ago`;
  }
  return `Last update ${seconds} seconds ago`;
}
