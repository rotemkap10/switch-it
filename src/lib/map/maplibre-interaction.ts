import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * MapLibre default pan-inertia values (see handler_inertia defaultPanInertiaOptions).
 * Passed explicitly so re-calling `dragPan.enable()` cannot wipe inertia back to `{}`.
 * Find Parking (BaseMap) and Share a Spot (picker) must share this.
 */
export const MAP_DRAG_PAN_INERTIA_OPTIONS = {
  linearity: 0.3,
  deceleration: 2500,
  maxSpeed: 1400,
} as const;

/**
 * Shared MapLibre constructor interaction flags for Switch It maps.
 * Keep pitch/rotate off; keep one-finger pan + pinch zoom with native inertia.
 */
export const MAP_INTERACTION_OPTIONS = {
  dragPan: MAP_DRAG_PAN_INERTIA_OPTIONS,
  dragRotate: false,
  touchPitch: false,
  pitchWithRotate: false,
  maxPitch: 0,
} as const;

export type MapInteractionMode = {
  /** When false, disable all pan/zoom handlers (preview / disabled picker). */
  enabled: boolean;
  /** Keep pinch zoom but suppress two-finger rotate (picker + seeker). */
  allowRotation?: boolean;
};

/**
 * Apply the shared mobile interaction profile after map creation or when
 * enabling/disabling the Share a Spot picker.
 */
export function applyMapInteractionMode(
  map: MapLibreMap,
  { enabled, allowRotation = false }: MapInteractionMode,
): void {
  const handlers = [
    map.scrollZoom,
    map.boxZoom,
    map.doubleClickZoom,
    map.touchZoomRotate,
    map.keyboard,
  ] as const;

  if (enabled) {
    map.dragPan.enable({ ...MAP_DRAG_PAN_INERTIA_OPTIONS });
    for (const handler of handlers) {
      handler.enable();
    }
    if (
      !allowRotation &&
      typeof map.touchZoomRotate.disableRotation === "function"
    ) {
      map.touchZoomRotate.disableRotation();
    }
    return;
  }

  map.dragPan.disable();
  for (const handler of handlers) {
    handler.disable();
  }
}
