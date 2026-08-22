import type { Map as MapLibreMap } from "maplibre-gl";

type MapWithRemovedFlag = MapLibreMap & { _removed?: boolean };

/**
 * True when MapLibre can still accept style/source/layer mutations.
 * Guards async callbacks (rAF, Realtime) after map.remove() / unmount.
 */
export function isMapUsable(map: MapLibreMap | null | undefined): map is MapLibreMap {
  if (!map) {
    return false;
  }
  try {
    if ((map as MapWithRemovedFlag)._removed) {
      return false;
    }
    const canvas = map.getCanvas?.();
    if (!canvas || !canvas.parentElement) {
      return false;
    }
    if (typeof map.isStyleLoaded === "function" && !map.isStyleLoaded()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
