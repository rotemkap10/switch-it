import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * Shared MapLibre constructor interaction flags for Switch It maps.
 * Initialized ONCE in BaseMap — Find Parking and Share a Spot must not
 * re-enable / reconfigure dragPan after construction.
 *
 * Values match MapLibre's default pan-inertia profile
 * (handler_inertia defaultPanInertiaOptions).
 */
export const MAP_INTERACTION_OPTIONS = {
  dragPan: {
    linearity: 0.3,
    deceleration: 2500,
    maxSpeed: 1400,
  },
  dragRotate: false,
  touchPitch: false,
  pitchWithRotate: false,
  maxPitch: 0,
} as const;

/** True while a user drag or MapLibre ease/inertia is in progress. */
export function isMapCameraBusy(map: MapLibreMap): boolean {
  if (typeof map.isMoving === "function" && map.isMoving()) {
    return true;
  }
  const maybeEasing = map as MapLibreMap & { isEasing?: () => boolean };
  if (typeof maybeEasing.isEasing === "function" && maybeEasing.isEasing()) {
    return true;
  }
  return false;
}
