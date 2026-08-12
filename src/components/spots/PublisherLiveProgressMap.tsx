"use client";

import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BaseMap } from "@/components/map/BaseMap";
import { MapUnavailable } from "@/components/map/MapUnavailable";
import type { SeekerLocationPayload } from "@/lib/location/payload";
import { focusPublisherHandoffCamera } from "@/lib/map/focus-publisher-handoff";
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
  pauseHint?: string | null;
  progressLabel?: string | null;
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

/**
 * Compact publisher live-progress map: parking marker + ephemeral seeker vehicle.
 * Updates GeoJSON via setData — does not recreate MapLibre.
 */
export function PublisherLiveProgressMap({
  parkingLatitude,
  parkingLongitude,
  seekerLocation,
  statusLabel,
  updatedLabel,
  pauseHint = null,
  progressLabel = null,
  expanded = false,
  onExpandedChange,
}: PublisherLiveProgressMapProps) {
  const styleUrl = useMemo(() => assertMapTilerStyleUrlOrNull(), []);
  const mapRef = useRef<MapLibreMap | null>(null);
  const initializedRef = useRef(false);
  const pendingFocusRef = useRef(false);
  const parkingRef = useRef({
    latitude: parkingLatitude,
    longitude: parkingLongitude,
  });
  const seekerRef = useRef(seekerLocation);
  const [mapReady, setMapReady] = useState(false);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [mapInstanceKey, setMapInstanceKey] = useState(0);
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
    parkingRef.current = {
      latitude: parkingLatitude,
      longitude: parkingLongitude,
    };
  }, [parkingLatitude, parkingLongitude]);

  useEffect(() => {
    seekerRef.current = seekerLocation;
  }, [seekerLocation]);

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

  const focusHandoff = useCallback(() => {
    const map = mapRef.current;
    if (!map || !initializedRef.current) {
      pendingFocusRef.current = true;
      return;
    }
    pendingFocusRef.current = false;
    const seeker = seekerRef.current;
    focusPublisherHandoffCamera(
      map,
      parkingRef.current,
      seeker
        ? {
            longitude: seeker.longitude,
            latitude: seeker.latitude,
          }
        : null,
      { reducedMotion: prefersReducedMotion() },
    );
  }, []);

  useEffect(() => {
    if (!mapReady || !pendingFocusRef.current) {
      return;
    }
    focusHandoff();
  }, [mapReady, focusHandoff]);

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
  }, [mapReady, parkingLatitude, parkingLongitude, seekerLocation]);

  if (styleUrl === null) {
    return (
      <div
        className={`flex items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-border ${publisherPreviewShellClass("claimed")}`}
        aria-label="Live progress map"
      >
        <MapUnavailable reason="configuration" />
      </div>
    );
  }

  if (mapUnavailable) {
    return (
      <div
        className={[
          "flex items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-border p-4",
          shellClass,
        ].join(" ")}
        aria-label="Live progress map"
      >
        <MapUnavailable
          reason="temporary"
          onRetry={() => {
            initializedRef.current = false;
            displaySeekerRef.current = null;
            mapRef.current = null;
            pendingFocusRef.current = false;
            setMapReady(false);
            setMapUnavailable(false);
            setMapInstanceKey((key) => key + 1);
          }}
        />
      </div>
    );
  }

  const showUpdated =
    Boolean(seekerLocation) && updatedLabel && updatedLabel !== "Waiting";

  return (
    <div className="flex flex-col gap-2" data-testid="publisher-live-progress">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">Driver location</p>
        <p
          className="text-sm text-foreground"
          aria-live="polite"
          data-testid="publisher-live-status"
        >
          {statusLabel}
        </p>
        {progressLabel ? (
          <p
            className="mt-0.5 text-sm font-medium text-foreground"
            data-testid="publisher-driver-distance"
          >
            {progressLabel}
          </p>
        ) : null}
        {pauseHint ? (
          <p
            className="mt-0.5 text-xs text-muted"
            data-testid="publisher-live-pause-hint"
          >
            {pauseHint}
          </p>
        ) : null}
        {showUpdated ? (
          <p
            className="mt-0.5 text-xs text-muted"
            data-testid="publisher-live-updated"
          >
            {updatedLabel}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-muted" data-testid="publisher-live-legend">
          Parking spot
          {seekerLocation ? " · Approaching driver" : ""}
        </p>
      </div>

      <div
        className={[
          "relative w-full overflow-hidden rounded-[var(--radius-card)] border border-border",
          shellClass,
        ].join(" ")}
        aria-label={statusLabel}
        data-testid="publisher-live-progress-map"
        data-has-destination="true"
        data-has-seeker={seekerLocation ? "true" : "false"}
      >
        <BaseMap
          key={mapInstanceKey}
          styleUrl={styleUrl}
          center={center}
          zoom={MAP_SELECTED_SPOT_ZOOM}
          className="absolute inset-0 h-full w-full"
          onMapUnavailable={() => setMapUnavailable(true)}
          onMapReady={(map) => {
            mapRef.current = map;
            if (initializedRef.current) {
              setMapReady(true);
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

            if (map.hasImage(SEEKER_MARKER_IMAGE_IDS.seekerLive)) {
              map.addLayer({
                id: SEEKER_LAYER,
                type: "symbol",
                source: SEEKER_SOURCE,
                layout: {
                  "icon-image": SEEKER_MARKER_IMAGE_IDS.seekerLive,
                  "icon-size": 0.8,
                  "icon-allow-overlap": true,
                },
              });
            }

            map.resize();
            setMapReady(true);
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
        <button
          type="button"
          data-testid="publisher-handoff-focus"
          className="motion-interactive-press min-h-10 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground"
          aria-label={
            seekerLocation
              ? "Focus parking spot and approaching driver"
              : "Focus parking spot"
          }
          onClick={focusHandoff}
        >
          Follow
        </button>
      </div>
    </div>
  );
}
