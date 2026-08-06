"use client";

import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";

import { BaseMap } from "@/components/map/BaseMap";
import { MapUnavailable } from "@/components/map/MapUnavailable";
import type { SeekerLocationPayload } from "@/lib/location/payload";
import { publisherPreviewShellClass } from "@/lib/map/leaverMapShell";
import {
  MAP_SELECTED_SPOT_ZOOM,
  assertMapTilerStyleUrlOrNull,
} from "@/lib/map/seekerMapConfig";
import {
  SEEKER_MARKER_IMAGE_IDS,
  registerSeekerMarkerImages,
} from "@/lib/map/seekerMarkerImages";

const DEST_SOURCE = "publisher-live-dest-src";
const DEST_LAYER = "publisher-live-dest-layer";
const SEEKER_SOURCE = "publisher-live-seeker-src";
const SEEKER_LAYER = "publisher-live-seeker-layer";
const ACCURACY_SOURCE = "publisher-live-accuracy-src";
const ACCURACY_LAYER = "publisher-live-accuracy-layer";

export type PublisherLiveProgressMapProps = {
  parkingLatitude: number;
  parkingLongitude: number;
  seekerLocation: SeekerLocationPayload | null;
  statusLabel: string;
  updatedLabel: string;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function emptyCollection(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function fitParkingAndSeeker(
  map: MapLibreMap,
  parkingLng: number,
  parkingLat: number,
  seekerLng: number,
  seekerLat: number,
) {
  map.fitBounds(
    [
      [Math.min(parkingLng, seekerLng), Math.min(parkingLat, seekerLat)],
      [Math.max(parkingLng, seekerLng), Math.max(parkingLat, seekerLat)],
    ],
    {
      padding: 48,
      maxZoom: 16,
      duration: prefersReducedMotion() ? 0 : 400,
    },
  );
}

/**
 * Compact publisher live-progress map: parking pin + ephemeral seeker marker.
 * Updates GeoJSON via setData — does not recreate MapLibre.
 */
export function PublisherLiveProgressMap({
  parkingLatitude,
  parkingLongitude,
  seekerLocation,
  statusLabel,
  updatedLabel,
  expanded = false,
  onExpandedChange,
}: PublisherLiveProgressMapProps) {
  const styleUrl = useMemo(() => assertMapTilerStyleUrlOrNull(), []);
  const mapRef = useRef<MapLibreMap | null>(null);
  const initializedRef = useRef(false);
  const followRef = useRef(true);
  const didInitialFitRef = useRef(false);
  const [follow, setFollow] = useState(true);
  const displaySeekerRef = useRef<{ lat: number; lng: number } | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const accuracyRef = useRef(20);

  const center = useMemo(
    (): [number, number] => [parkingLongitude, parkingLatitude],
    [parkingLongitude, parkingLatitude],
  );

  const shellClass = expanded
    ? "publisher-live-map-shell publisher-live-map-shell--expanded"
    : "publisher-live-map-shell publisher-live-map-shell--collapsed";

  useEffect(() => {
    followRef.current = follow;
  }, [follow]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    mapRef.current?.resize();
  }, [expanded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !initializedRef.current) {
      return;
    }

    const destSource = map.getSource(DEST_SOURCE) as GeoJSONSource | undefined;
    destSource?.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: [parkingLongitude, parkingLatitude],
          },
        },
      ],
    });

    const seekerSource = map.getSource(SEEKER_SOURCE) as GeoJSONSource | undefined;
    const accuracySource = map.getSource(
      ACCURACY_SOURCE,
    ) as GeoJSONSource | undefined;

    if (!seekerLocation) {
      displaySeekerRef.current = null;
      seekerSource?.setData(emptyCollection());
      accuracySource?.setData(emptyCollection());
      didInitialFitRef.current = false;
      return;
    }

    accuracyRef.current = seekerLocation.accuracyMeters;
    const target = {
      lat: seekerLocation.latitude,
      lng: seekerLocation.longitude,
    };

    const applyPoint = (lat: number, lng: number) => {
      displaySeekerRef.current = { lat, lng };
      seekerSource?.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: [lng, lat] },
          },
        ],
      });
      accuracySource?.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {
              radiusPx: Math.min(48, Math.max(12, accuracyRef.current / 2)),
            },
            geometry: { type: "Point", coordinates: [lng, lat] },
          },
        ],
      });
    };

    const from = displaySeekerRef.current;
    if (!from || prefersReducedMotion()) {
      applyPoint(target.lat, target.lng);
    } else {
      const start = performance.now();
      const duration = 280;
      const startLat = from.lat;
      const startLng = from.lng;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - t) * (1 - t);
        applyPoint(
          startLat + (target.lat - startLat) * eased,
          startLng + (target.lng - startLng) * eased,
        );
        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(tick);
        }
      };
      animFrameRef.current = requestAnimationFrame(tick);
    }

    if (!didInitialFitRef.current) {
      didInitialFitRef.current = true;
      fitParkingAndSeeker(
        map,
        parkingLongitude,
        parkingLatitude,
        seekerLocation.longitude,
        seekerLocation.latitude,
      );
    }
  }, [parkingLatitude, parkingLongitude, seekerLocation]);

  if (styleUrl === null) {
    return (
      <div
        className={`flex items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-border ${publisherPreviewShellClass("claimed")}`}
        aria-label="Live progress map"
      >
        <MapUnavailable />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="publisher-live-progress">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">Driver location</p>
        <p className="text-sm text-foreground" aria-live="polite">
          {statusLabel}
        </p>
        <p className="text-xs text-muted">{updatedLabel}</p>
      </div>

      <div
        className={[
          "relative w-full overflow-hidden rounded-[var(--radius-card)] border border-border",
          shellClass,
        ].join(" ")}
        aria-label={`${statusLabel}. ${updatedLabel}`}
        data-testid="publisher-live-progress-map"
      >
        <BaseMap
          styleUrl={styleUrl}
          center={center}
          zoom={MAP_SELECTED_SPOT_ZOOM}
          className="absolute inset-0 h-full w-full"
          onMapReady={(map) => {
            mapRef.current = map;
            if (initializedRef.current) {
              return;
            }
            initializedRef.current = true;

            registerSeekerMarkerImages(map);

            map.addSource(DEST_SOURCE, {
              type: "geojson",
              data: {
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    properties: {},
                    geometry: {
                      type: "Point",
                      coordinates: [parkingLongitude, parkingLatitude],
                    },
                  },
                ],
              },
            });
            map.addSource(SEEKER_SOURCE, {
              type: "geojson",
              data: emptyCollection(),
            });
            map.addSource(ACCURACY_SOURCE, {
              type: "geojson",
              data: emptyCollection(),
            });

            map.addLayer({
              id: ACCURACY_LAYER,
              type: "circle",
              source: ACCURACY_SOURCE,
              paint: {
                "circle-radius": ["get", "radiusPx"],
                "circle-color": "rgba(85,191,243,0.18)",
                "circle-stroke-color": "rgba(85,191,243,0.5)",
                "circle-stroke-width": 1,
              },
            });

            if (map.hasImage(SEEKER_MARKER_IMAGE_IDS.destination)) {
              map.addLayer({
                id: DEST_LAYER,
                type: "symbol",
                source: DEST_SOURCE,
                layout: {
                  "icon-image": SEEKER_MARKER_IMAGE_IDS.destination,
                  "icon-size": 0.85,
                  "icon-allow-overlap": true,
                },
              });
            }

            map.addLayer({
              id: SEEKER_LAYER,
              type: "circle",
              source: SEEKER_SOURCE,
              paint: {
                "circle-radius": 7,
                "circle-color": "#2fa9e6",
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2,
              },
            });

            const disableFollow = () => setFollow(false);
            map.on("dragstart", disableFollow);
            map.on("zoomstart", (e) => {
              if (e.originalEvent) {
                disableFollow();
              }
            });

            map.resize();
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {onExpandedChange ? (
          <button
            type="button"
            className="motion-interactive-press min-h-10 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground"
            onClick={() => onExpandedChange(!expanded)}
            aria-expanded={expanded}
          >
            {expanded ? "Collapse map" : "Expand map"}
          </button>
        ) : null}
        {seekerLocation ? (
          <button
            type="button"
            className="motion-interactive-press min-h-10 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground"
            aria-pressed={follow}
            onClick={() => {
              setFollow(true);
              const map = mapRef.current;
              if (!map) {
                return;
              }
              fitParkingAndSeeker(
                map,
                parkingLongitude,
                parkingLatitude,
                seekerLocation.longitude,
                seekerLocation.latitude,
              );
            }}
          >
            Follow
          </button>
        ) : null}
      </div>
    </div>
  );
}
