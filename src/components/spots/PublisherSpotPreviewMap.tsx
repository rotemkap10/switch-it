"use client";

import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useMemo, useRef, useState } from "react";

import { BaseMap } from "@/components/map/BaseMap";
import { MapUnavailable } from "@/components/map/MapUnavailable";
import {
  publisherPreviewShellClass,
  type PublisherPreviewVariant,
} from "@/lib/map/leaverMapShell";
import {
  MAP_SELECTED_SPOT_ZOOM,
  assertMapTilerStyleUrlOrNull,
} from "@/lib/map/seekerMapConfig";
import {
  SEEKER_MARKER_IMAGE_IDS,
  registerSeekerMarkerImages,
} from "@/lib/map/seekerMarkerImages";

const PREVIEW_SOURCE = "publisher-preview-src";
const PREVIEW_LAYER = "publisher-preview-layer";

export type PublisherSpotPreviewMapProps = {
  latitude: number;
  longitude: number;
  variant?: PublisherPreviewVariant;
  ariaLabel?: string;
  testId?: string;
};

function disableMapChrome(map: MapLibreMap) {
  const handlers = [
    map.dragPan,
    map.scrollZoom,
    map.boxZoom,
    map.doubleClickZoom,
    map.touchZoomRotate,
    map.keyboard,
  ] as const;

  for (const handler of handlers) {
    handler.disable();
  }
}

/**
 * Compact, non-interactive MapLibre preview of the publisher's parked spot.
 * Coordinates only — no geolocation or seeker data.
 */
export function PublisherSpotPreviewMap({
  latitude,
  longitude,
  variant = "available",
  ariaLabel = "Map preview of your parking spot",
  testId = "publisher-spot-preview-map",
}: PublisherSpotPreviewMapProps) {
  const styleUrl = useMemo(() => assertMapTilerStyleUrlOrNull(), []);
  const initializedRef = useRef(false);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [mapInstanceKey, setMapInstanceKey] = useState(0);
  const center = useMemo(
    (): [number, number] => [longitude, latitude],
    [longitude, latitude],
  );
  const shellClass = publisherPreviewShellClass(variant);

  if (styleUrl === null) {
    return (
      <div
        className={`flex items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-border ${shellClass}`}
        aria-label={ariaLabel}
      >
        <MapUnavailable reason="configuration" />
      </div>
    );
  }

  if (mapUnavailable) {
    return (
      <div
        className={`flex items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-border p-4 ${shellClass}`}
        aria-label={ariaLabel}
      >
        <MapUnavailable
          reason="temporary"
          onRetry={() => {
            initializedRef.current = false;
            setMapUnavailable(false);
            setMapInstanceKey((key) => key + 1);
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={[
        "relative w-full overflow-hidden rounded-[var(--radius-card)] border border-border motion-fade-in",
        shellClass,
      ].join(" ")}
      aria-label={ariaLabel}
      data-testid={testId}
      data-latitude={String(latitude)}
      data-longitude={String(longitude)}
      data-preview-variant={variant}
    >
      <BaseMap
        key={mapInstanceKey}
        styleUrl={styleUrl}
        center={center}
        zoom={MAP_SELECTED_SPOT_ZOOM}
        className="absolute inset-0 h-full w-full"
        onMapUnavailable={() => setMapUnavailable(true)}
        onMapReady={(map) => {
          if (initializedRef.current) {
            return;
          }
          initializedRef.current = true;

          disableMapChrome(map);
          registerSeekerMarkerImages(map);

          if (!map.getSource(PREVIEW_SOURCE)) {
            map.addSource(PREVIEW_SOURCE, {
              type: "geojson",
              data: {
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    properties: {},
                    geometry: {
                      type: "Point",
                      coordinates: [longitude, latitude],
                    },
                  },
                ],
              },
            });
          } else {
            const source = map.getSource(PREVIEW_SOURCE) as GeoJSONSource;
            source.setData({
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "Point",
                    coordinates: [longitude, latitude],
                  },
                },
              ],
            });
          }

          if (
            map.hasImage(SEEKER_MARKER_IMAGE_IDS.destination) &&
            !map.getLayer(PREVIEW_LAYER)
          ) {
            map.addLayer({
              id: PREVIEW_LAYER,
              type: "symbol",
              source: PREVIEW_SOURCE,
              layout: {
                "icon-image": SEEKER_MARKER_IMAGE_IDS.destination,
                "icon-size": 0.9,
                "icon-allow-overlap": true,
              },
            });
          }

          map.jumpTo({
            center: [longitude, latitude],
            zoom: MAP_SELECTED_SPOT_ZOOM,
          });
          map.resize();
        }}
      />
    </div>
  );
}
