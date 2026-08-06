import {
  LIVE_LOCATION_ACCURACY_IMPROVE_M,
  LIVE_LOCATION_HEADING_CHANGE_DEG,
  LIVE_LOCATION_HEARTBEAT_MS,
  LIVE_LOCATION_MEANINGFUL_MOVE_M,
  LIVE_LOCATION_MIN_SEND_INTERVAL_MS,
  LIVE_LOCATION_PREFERRED_SEND_INTERVAL_MS,
} from "@/lib/location/constants";
import { haversineDistanceMeters } from "@/lib/map/distance";

export type LocationSample = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  headingDegrees: number | null;
  atMs: number;
};

export type ThrottleDecision =
  | { send: false; reason: "too_soon" | "no_change" }
  | { send: true; reason: "first" | "moved" | "heading" | "accuracy" | "heartbeat" };

function headingDelta(
  a: number | null,
  b: number | null,
): number | null {
  if (a === null || b === null) {
    return null;
  }
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

/**
 * Pure throttle policy for seeker-location broadcasts.
 * Never sends more often than LIVE_LOCATION_MIN_SEND_INTERVAL_MS.
 */
export function shouldBroadcastLocation(
  previous: LocationSample | null,
  next: LocationSample,
): ThrottleDecision {
  if (!previous) {
    return { send: true, reason: "first" };
  }

  const elapsed = next.atMs - previous.atMs;
  if (elapsed < LIVE_LOCATION_MIN_SEND_INTERVAL_MS) {
    return { send: false, reason: "too_soon" };
  }

  const moved = haversineDistanceMeters(
    { latitude: previous.latitude, longitude: previous.longitude },
    { latitude: next.latitude, longitude: next.longitude },
  );

  if (
    elapsed >= LIVE_LOCATION_PREFERRED_SEND_INTERVAL_MS &&
    moved >= LIVE_LOCATION_MEANINGFUL_MOVE_M
  ) {
    return { send: true, reason: "moved" };
  }

  const turn = headingDelta(previous.headingDegrees, next.headingDegrees);
  if (
    moved >= 5 &&
    turn !== null &&
    turn >= LIVE_LOCATION_HEADING_CHANGE_DEG &&
    elapsed >= LIVE_LOCATION_MIN_SEND_INTERVAL_MS
  ) {
    return { send: true, reason: "heading" };
  }

  if (
    previous.accuracyMeters - next.accuracyMeters >=
      LIVE_LOCATION_ACCURACY_IMPROVE_M &&
    elapsed >= LIVE_LOCATION_MIN_SEND_INTERVAL_MS
  ) {
    return { send: true, reason: "accuracy" };
  }

  if (elapsed >= LIVE_LOCATION_HEARTBEAT_MS) {
    return { send: true, reason: "heartbeat" };
  }

  return { send: false, reason: "no_change" };
}
