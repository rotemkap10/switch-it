import {
  MAP_DEFAULT_ZOOM,
  MAP_MOVEMENT_DURATION_MS,
  MAP_SELECTED_SPOT_ZOOM,
} from "@/lib/map/seekerMapConfig";

export type MapCameraLike = {
  easeTo: (options: {
    center: [number, number];
    zoom?: number;
    offset?: [number, number];
    duration?: number;
    essential?: boolean;
  }) => void;
  getZoom: () => number;
};

export type FocusSelectedSpotOptions = {
  longitude: number;
  latitude: number;
  /** Shift the focal point upward so bottom overlays do not cover the marker. */
  offsetY?: number;
  durationMs?: number;
  /** When true, keep current zoom (only pan). Default keeps a mild street-level zoom. */
  preserveZoom?: boolean;
};

/**
 * Gently pan/ease so a selected spot stays visible above bottom overlays.
 * Does not recreate the map. Callers must skip when the same id is re-selected.
 */
export function focusSelectedSpot(
  map: MapCameraLike,
  options: FocusSelectedSpotOptions,
): void {
  const currentZoom = map.getZoom();
  const zoom = options.preserveZoom
    ? currentZoom
    : Math.min(
        MAP_SELECTED_SPOT_ZOOM,
        Math.max(currentZoom, MAP_DEFAULT_ZOOM),
      );

  map.easeTo({
    center: [options.longitude, options.latitude],
    zoom,
    offset: [0, options.offsetY ?? -96],
    duration: options.durationMs ?? MAP_MOVEMENT_DURATION_MS,
    essential: true,
  });
}
