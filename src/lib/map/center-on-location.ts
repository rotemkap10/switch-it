import {
  MAP_DEFAULT_ZOOM,
  MAP_SELECTED_SPOT_ZOOM,
} from "@/lib/map/seekerMapConfig";

export type MapCameraLike = {
  easeTo: (options: {
    center: [number, number];
    zoom?: number;
    duration?: number;
    essential?: boolean;
  }) => void;
  getZoom: () => number;
};

export type CenterMapOnLocationOptions = {
  /** Preserve zoom when already at or above this level. */
  minPreserveZoom?: number;
  /** Zoom floor when current zoom is below minPreserveZoom. */
  fallbackZoom?: number;
  /** Picker: never zoom out below street level. */
  minStreetZoom?: boolean;
  /** When set, use this zoom instead of preserve/fallback logic. */
  zoom?: number;
  durationMs?: number;
  reducedMotion?: boolean;
};

const RECENTER_DURATION_MS = 450;

/**
 * Animate (or jump) the map camera to a device location fix.
 */
export function centerMapOnLocation(
  map: MapCameraLike,
  longitude: number,
  latitude: number,
  options: CenterMapOnLocationOptions = {},
): void {
  const {
    minPreserveZoom = MAP_DEFAULT_ZOOM,
    fallbackZoom = MAP_DEFAULT_ZOOM,
    minStreetZoom = false,
    zoom: forcedZoom,
    durationMs = RECENTER_DURATION_MS,
    reducedMotion = false,
  } = options;

  const currentZoom = map.getZoom();
  let targetZoom = currentZoom;

  if (forcedZoom != null && Number.isFinite(forcedZoom)) {
    targetZoom = forcedZoom;
  } else if (minStreetZoom) {
    targetZoom = Math.max(currentZoom, MAP_SELECTED_SPOT_ZOOM);
  } else if (currentZoom >= minPreserveZoom) {
    targetZoom = currentZoom;
  } else {
    targetZoom = fallbackZoom;
  }

  map.easeTo({
    center: [longitude, latitude],
    zoom: targetZoom,
    duration: reducedMotion ? 0 : durationMs,
    essential: true,
  });
}
