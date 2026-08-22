import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

import { MAP_LAYERS, MAP_SOURCES } from "@/lib/map/seekerMapConfig";

/** Fixed on-screen size of the current-location puck (pixels). Never scales with GPS accuracy. */
export const USER_LOCATION_DOT_RADIUS_PX = 6;

export type UserLocationDotIds = {
  dotSource: string;
  dotLayer: string;
};

export const SEEKER_USER_LOCATION_IDS: UserLocationDotIds = {
  dotSource: MAP_SOURCES.userLocation,
  dotLayer: MAP_LAYERS.userDot,
};

/** @deprecated Alias of seeker IDs — Find Parking and Share a Spot share one puck. */
export const PICKER_USER_LOCATION_IDS: UserLocationDotIds = SEEKER_USER_LOCATION_IDS;

export type UserLocationDotFix = {
  latitude: number;
  longitude: number;
  /** Kept for call-site compatibility; never visualized as a map radius. */
  accuracy?: number | null;
};

function emptyFeatureCollection(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function asGeoJsonSource(
  map: MapLibreMap,
  id: string,
): GeoJSONSource | null {
  const source = map.getSource(id);
  if (!source || source.type !== "geojson") {
    return null;
  }
  return source as GeoJSONSource;
}

function ensureUserLocationLayers(
  map: MapLibreMap,
  ids: UserLocationDotIds,
) {
  if (!map.getSource(ids.dotSource)) {
    map.addSource(ids.dotSource, {
      type: "geojson",
      data: emptyFeatureCollection(),
    });
  }

  if (!map.getLayer(ids.dotLayer)) {
    map.addLayer({
      id: ids.dotLayer,
      type: "circle",
      source: ids.dotSource,
      paint: {
        "circle-radius": USER_LOCATION_DOT_RADIUS_PX,
        "circle-color": "#55bff3",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });
  }
}

/**
 * Show or clear the live current-location puck. Safe to call before or after
 * style load; no-ops when the map is not ready.
 *
 * Renders a fixed-size blue dot only — no GPS accuracy halo/circle.
 */
export function syncUserLocationDot(
  map: MapLibreMap | null | undefined,
  ids: UserLocationDotIds,
  location: UserLocationDotFix | null,
): void {
  if (!map) {
    return;
  }

  try {
    if (!location) {
      const dotSource = asGeoJsonSource(map, ids.dotSource);
      dotSource?.setData(emptyFeatureCollection());
      return;
    }

    ensureUserLocationLayers(map, ids);

    const dotSource = asGeoJsonSource(map, ids.dotSource);
    if (!dotSource) {
      return;
    }

    const coordinates: [number, number] = [
      location.longitude,
      location.latitude,
    ];

    // accuracy is intentionally ignored for visualization.
    void location.accuracy;

    dotSource.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates },
          properties: {},
        },
      ],
    });
  } catch {
    // Location is optional: never take the map down if the puck fails.
  }
}
