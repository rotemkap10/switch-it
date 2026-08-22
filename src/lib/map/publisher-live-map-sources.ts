import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

import type { SeekerLocationPayload } from "@/lib/location/payload";
import { logHandoffLive } from "@/lib/location/log-handoff-live";
import { isMapUsable } from "@/lib/map/map-instance-guards";
import {
  SEEKER_MARKER_IMAGE_IDS,
  registerSeekerMarkerImages,
} from "@/lib/map/seekerMarkerImages";

export const PUBLISHER_LIVE_DEST_SOURCE = "publisher-live-dest-src";
export const PUBLISHER_LIVE_DEST_LAYER = "publisher-live-dest-layer";
export const PUBLISHER_LIVE_SEEKER_SOURCE = "publisher-live-seeker-src";
export const PUBLISHER_LIVE_SEEKER_LAYER = "publisher-live-seeker-layer";
export const PUBLISHER_LIVE_SEEKER_LAYER_FALLBACK =
  "publisher-live-seeker-fallback-layer";
export const PUBLISHER_LIVE_ACCURACY_SOURCE = "publisher-live-accuracy-src";
export const PUBLISHER_LIVE_ACCURACY_LAYER = "publisher-live-accuracy-layer";

type MapWithRemovedFlag = MapLibreMap & { _removed?: boolean };

export type PublisherLiveMapLifecycle = {
  mapLoaded: boolean;
  mapRemoved: boolean;
  styleLoaded: boolean;
  seekerSourceExists: boolean;
  seekerSourceReady: boolean;
};

function emptyCollection(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function pointCollection(
  longitude: number,
  latitude: number,
  properties: GeoJSON.GeoJsonProperties = {},
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties,
        geometry: { type: "Point", coordinates: [longitude, latitude] },
      },
    ],
  };
}

export function publisherLiveMapLifecycle(
  map: MapLibreMap | null | undefined,
): PublisherLiveMapLifecycle {
  if (!map) {
    return {
      mapLoaded: false,
      mapRemoved: true,
      styleLoaded: false,
      seekerSourceExists: false,
      seekerSourceReady: false,
    };
  }

  let mapRemoved = false;
  let styleLoaded = false;
  try {
    mapRemoved = Boolean((map as MapWithRemovedFlag)._removed);
    styleLoaded =
      typeof map.isStyleLoaded !== "function" ? true : Boolean(map.isStyleLoaded());
  } catch {
    mapRemoved = true;
  }

  const seekerSource = asGeoJsonSource(map, PUBLISHER_LIVE_SEEKER_SOURCE);
  return {
    mapLoaded: true,
    mapRemoved,
    styleLoaded,
    seekerSourceExists: Boolean(map.getSource(PUBLISHER_LIVE_SEEKER_SOURCE)),
    seekerSourceReady: seekerSource != null,
  };
}

export function handoffLiveErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export function logPublisherLiveMapUpdateFailure(
  error: unknown,
  context: PublisherLiveMapLifecycle & { claimId?: string | null },
): void {
  const errorName = error instanceof Error ? error.name : typeof error;
  logHandoffLive(
    [
      "publisher live map update failed",
      `errorName=${String(errorName)}`,
      `errorMessage=${handoffLiveErrorMessage(error)}`,
      `sourceExists=${context.seekerSourceExists}`,
      `sourceReady=${context.seekerSourceReady}`,
      `mapLoaded=${context.mapLoaded}`,
      `mapRemoved=${context.mapRemoved}`,
      `styleLoaded=${context.styleLoaded}`,
      context.claimId != null ? `claimId=${context.claimId}` : null,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function asGeoJsonSource(
  map: MapLibreMap,
  sourceId: string,
): GeoJSONSource | null {
  const source = map.getSource(sourceId);
  if (!source || source.type !== "geojson") {
    return null;
  }
  return source as GeoJSONSource;
}

function addSeekerDisplayLayer(map: MapLibreMap) {
  if (
    map.getLayer(PUBLISHER_LIVE_SEEKER_LAYER) ||
    map.getLayer(PUBLISHER_LIVE_SEEKER_LAYER_FALLBACK)
  ) {
    return;
  }
  if (map.hasImage(SEEKER_MARKER_IMAGE_IDS.seekerLive)) {
    map.addLayer({
      id: PUBLISHER_LIVE_SEEKER_LAYER,
      type: "symbol",
      source: PUBLISHER_LIVE_SEEKER_SOURCE,
      layout: {
        "icon-image": SEEKER_MARKER_IMAGE_IDS.seekerLive,
        "icon-size": 0.78,
        "icon-anchor": "center",
        "icon-allow-overlap": true,
      },
    });
    return;
  }
  map.addLayer({
    id: PUBLISHER_LIVE_SEEKER_LAYER_FALLBACK,
    type: "circle",
    source: PUBLISHER_LIVE_SEEKER_SOURCE,
    paint: {
      "circle-radius": 9,
      "circle-color": "#55bff3",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });
}

export function collectionsForPublisherSeeker(
  location: SeekerLocationPayload | null,
): {
  seeker: GeoJSON.FeatureCollection;
  accuracy: GeoJSON.FeatureCollection;
} {
  if (!location) {
    return { seeker: emptyCollection(), accuracy: emptyCollection() };
  }
  return {
    seeker: pointCollection(location.longitude, location.latitude),
    accuracy: pointCollection(location.longitude, location.latitude, {
      radiusPx: Math.min(48, Math.max(12, location.accuracyMeters / 2)),
    }),
  };
}

/** Idempotent MapLibre source/layer setup for the publisher live handoff map. */
export function ensurePublisherLiveMapSources(
  map: MapLibreMap,
  parkingLongitude: number,
  parkingLatitude: number,
  seekerLocation: SeekerLocationPayload | null,
): void {
  if (!isMapUsable(map)) {
    return;
  }

  registerSeekerMarkerImages(map);
  const live = collectionsForPublisherSeeker(seekerLocation);

  if (!map.getSource(PUBLISHER_LIVE_DEST_SOURCE)) {
    map.addSource(PUBLISHER_LIVE_DEST_SOURCE, {
      type: "geojson",
      data: pointCollection(parkingLongitude, parkingLatitude),
    });
  }

  if (!map.getSource(PUBLISHER_LIVE_SEEKER_SOURCE)) {
    map.addSource(PUBLISHER_LIVE_SEEKER_SOURCE, {
      type: "geojson",
      data: live.seeker,
    });
  }

  if (!map.getSource(PUBLISHER_LIVE_ACCURACY_SOURCE)) {
    map.addSource(PUBLISHER_LIVE_ACCURACY_SOURCE, {
      type: "geojson",
      data: live.accuracy,
    });
  }

  if (!map.getLayer(PUBLISHER_LIVE_ACCURACY_LAYER)) {
    map.addLayer({
      id: PUBLISHER_LIVE_ACCURACY_LAYER,
      type: "circle",
      source: PUBLISHER_LIVE_ACCURACY_SOURCE,
      paint: {
        "circle-radius": ["get", "radiusPx"],
        "circle-color": "rgba(85,191,243,0.18)",
        "circle-stroke-color": "rgba(85,191,243,0.5)",
        "circle-stroke-width": 1,
      },
    });
  }

  if (
    !map.getLayer(PUBLISHER_LIVE_DEST_LAYER) &&
    map.hasImage(SEEKER_MARKER_IMAGE_IDS.destination)
  ) {
    map.addLayer({
      id: PUBLISHER_LIVE_DEST_LAYER,
      type: "symbol",
      source: PUBLISHER_LIVE_DEST_SOURCE,
      layout: {
        "icon-image": SEEKER_MARKER_IMAGE_IDS.destination,
        "icon-size": 0.85,
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
      },
    });
  }

  if (
    !map.getLayer(PUBLISHER_LIVE_SEEKER_LAYER) &&
    !map.getLayer(PUBLISHER_LIVE_SEEKER_LAYER_FALLBACK)
  ) {
    addSeekerDisplayLayer(map);
  }
}

export type ApplyPublisherSeekerLocationResult =
  | { ok: true }
  | { ok: false; reason: "map_unavailable" | "source_unavailable" | "set_data_failed" };

/**
 * Apply the latest seeker fix to live GeoJSON sources. Resolves sources fresh
 * on each call — never uses a closed-over Source reference from an older map.
 */
export function applyPublisherSeekerLocation(
  map: MapLibreMap,
  parkingLongitude: number,
  parkingLatitude: number,
  location: SeekerLocationPayload,
): ApplyPublisherSeekerLocationResult {
  if (!isMapUsable(map)) {
    return { ok: false, reason: "map_unavailable" };
  }

  try {
    ensurePublisherLiveMapSources(
      map,
      parkingLongitude,
      parkingLatitude,
      location,
    );

    const destSource = asGeoJsonSource(map, PUBLISHER_LIVE_DEST_SOURCE);
    destSource?.setData(pointCollection(parkingLongitude, parkingLatitude));

    const seekerSource = asGeoJsonSource(map, PUBLISHER_LIVE_SEEKER_SOURCE);
    const accuracySource = asGeoJsonSource(map, PUBLISHER_LIVE_ACCURACY_SOURCE);
    if (!seekerSource || !accuracySource) {
      return { ok: false, reason: "source_unavailable" };
    }

    seekerSource.setData(
      pointCollection(location.longitude, location.latitude),
    );
    accuracySource.setData(
      pointCollection(location.longitude, location.latitude, {
        radiusPx: Math.min(48, Math.max(12, location.accuracyMeters / 2)),
      }),
    );

    return { ok: true };
  } catch {
    return { ok: false, reason: "set_data_failed" };
  }
}
