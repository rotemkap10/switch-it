import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

import { MAP_LAYERS, MAP_SOURCES } from "@/lib/map/seekerMapConfig";

export type UserLocationDotIds = {
  dotSource: string;
  accuracySource: string;
  dotLayer: string;
  accuracyLayer: string;
};

export const SEEKER_USER_LOCATION_IDS: UserLocationDotIds = {
  dotSource: MAP_SOURCES.userLocation,
  accuracySource: MAP_SOURCES.userAccuracy,
  dotLayer: MAP_LAYERS.userDot,
  accuracyLayer: MAP_LAYERS.userAccuracy,
};

export const PICKER_USER_LOCATION_IDS: UserLocationDotIds = {
  dotSource: "picker-user-location-src",
  accuracySource: "picker-user-accuracy-src",
  dotLayer: "picker-user-dot-layer",
  accuracyLayer: "picker-user-accuracy-layer",
};

export type UserLocationDotFix = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

function emptyFeatureCollection(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function haversineApproxDegDeltaFromMeters(lat: number, meters: number) {
  const metersPerDegLat = 111_320;
  return meters / metersPerDegLat;
}

export function metersToPixels(
  map: MapLibreMap,
  lng: number,
  lat: number,
  m: number,
) {
  if (!Number.isFinite(m) || m <= 0) {
    return 0;
  }

  const dLat = haversineApproxDegDeltaFromMeters(lat, m);
  const p1 = map.project([lng, lat]);
  const p2 = map.project([lng, lat + dLat]);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
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

  if (!map.getSource(ids.accuracySource)) {
    map.addSource(ids.accuracySource, {
      type: "geojson",
      data: emptyFeatureCollection(),
    });
  }

  if (!map.getLayer(ids.accuracyLayer)) {
    map.addLayer({
      id: ids.accuracyLayer,
      type: "circle",
      source: ids.accuracySource,
      paint: {
        "circle-radius": ["get", "radiusPx"],
        "circle-color": "rgba(85,191,243,0.18)",
        "circle-stroke-color": "rgba(85,191,243,0.55)",
        "circle-stroke-width": 1,
        "circle-opacity": [
          "case",
          [">", ["get", "radiusPx"], 0],
          1,
          0,
        ],
      },
    });
  }

  if (!map.getLayer(ids.dotLayer)) {
    map.addLayer({
      id: ids.dotLayer,
      type: "circle",
      source: ids.dotSource,
      paint: {
        "circle-radius": 6,
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
      const ringSource = asGeoJsonSource(map, ids.accuracySource);
      dotSource?.setData(emptyFeatureCollection());
      ringSource?.setData(emptyFeatureCollection());
      return;
    }

    ensureUserLocationLayers(map, ids);

    const dotSource = asGeoJsonSource(map, ids.dotSource);
    const ringSource = asGeoJsonSource(map, ids.accuracySource);
    if (!dotSource || !ringSource) {
      return;
    }

    const coordinates: [number, number] = [
      location.longitude,
      location.latitude,
    ];

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

    const radiusPx = metersToPixels(
      map,
      location.longitude,
      location.latitude,
      location.accuracy ?? 0,
    );

    ringSource.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates },
          properties: { radiusPx },
        },
      ],
    });
  } catch {
    // Location is optional: never take the map down if the puck fails.
  }
}
