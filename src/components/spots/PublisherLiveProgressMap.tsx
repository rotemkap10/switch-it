"use client";

import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BaseMap } from "@/components/map/BaseMap";
import { CurrentLocationControl } from "@/components/map/CurrentLocationControl";
import { MapUnavailable } from "@/components/map/MapUnavailable";
import { PORCELAIN, SIGNAL_BLUE } from "@/lib/branding/colors";
import { logHandoffLive } from "@/lib/location/log-handoff-live";
import type { SeekerLocationPayload } from "@/lib/location/payload";
import {
  focusPublisherHandoffCamera,
  keepPublisherHandoffInView,
} from "@/lib/map/focus-publisher-handoff";
import { publisherPreviewShellClass } from "@/lib/map/leaverMapShell";
import { applyMapDragPanInertia, isMapCameraBusy } from "@/lib/map/maplibre-interaction";
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
const SEEKER_LAYER_FALLBACK = "publisher-live-seeker-fallback-layer";
const ACCURACY_SOURCE = "publisher-live-accuracy-src";
const ACCURACY_LAYER = "publisher-live-accuracy-layer";

function addSeekerDisplayLayer(map: MapLibreMap) {
  if (map.getLayer(SEEKER_LAYER) || map.getLayer(SEEKER_LAYER_FALLBACK)) {
    return;
  }
  if (map.hasImage(SEEKER_MARKER_IMAGE_IDS.seekerLive)) {
    map.addLayer({
      id: SEEKER_LAYER,
      type: "symbol",
      source: SEEKER_SOURCE,
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
    id: SEEKER_LAYER_FALLBACK,
    type: "circle",
    source: SEEKER_SOURCE,
    paint: {
      "circle-radius": 9,
      "circle-color": SIGNAL_BLUE,
      "circle-stroke-width": 2,
      "circle-stroke-color": PORCELAIN,
    },
  });
  logHandoffLive("publisher marker fallback layer", {
    reason: "seekerLive_image_unavailable",
  });
}

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
  /** Slimmer labels — status lives in the parent card. */
  compactChrome?: boolean;
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

function collectionsForSeeker(location: SeekerLocationPayload | null): {
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
  compactChrome = false,
}: PublisherLiveProgressMapProps) {
  const styleUrl = useMemo(() => assertMapTilerStyleUrlOrNull(), []);
  const mapRef = useRef<MapLibreMap | null>(null);
  const initializedRef = useRef(false);
  const pendingFocusRef = useRef(false);
  const userPannedRef = useRef(false);
  const didAutoFocusSeekerRef = useRef(false);
  /** Automatic camera assistance (first fit + gentle keep-in-view). Not "Follow". */
  const autoCameraRef = useRef(true);
  const [autoCamera, setAutoCamera] = useState(true);
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
  const [hasKnownSeeker, setHasKnownSeeker] = useState(
    () => seekerLocation != null,
  );
  if (seekerLocation && !hasKnownSeeker) {
    setHasKnownSeeker(true);
  }

  const center = useMemo(
    (): [number, number] => [parkingLongitude, parkingLatitude],
    [parkingLongitude, parkingLatitude],
  );

  const shellClass = expanded
    ? "publisher-live-map-shell publisher-live-map-shell--expanded"
    : "publisher-live-map-shell publisher-live-map-shell--collapsed";

  useEffect(() => {
    autoCameraRef.current = autoCamera;
  }, [autoCamera]);

  const pauseAutoCamera = useCallback(() => {
    userPannedRef.current = true;
    autoCameraRef.current = false;
    setAutoCamera(false);
  }, []);

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
    userPannedRef.current = false;
    autoCameraRef.current = true;
    setAutoCamera(true);
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

  // First seeker fix: frame spot + driver once unless the user already panned.
  useEffect(() => {
    if (!mapReady || !seekerLocation || didAutoFocusSeekerRef.current) {
      return;
    }
    if (userPannedRef.current) {
      return;
    }
    didAutoFocusSeekerRef.current = true;
    focusHandoff();
  }, [mapReady, seekerLocation, focusHandoff]);

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
      // Keep the last known marker during brief update gaps.
      return;
    }

    if (
      !map.getLayer(SEEKER_LAYER) &&
      !map.getLayer(SEEKER_LAYER_FALLBACK)
    ) {
      addSeekerDisplayLayer(map);
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
    logHandoffLive("publisher marker updated", {
      lat: target.lat,
      lng: target.lng,
      sequence: seekerLocation.sequence,
      timestamp: seekerLocation.sentAt,
    });
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

    // Marker moves even while the publisher pans; only camera automation pauses.
    if (
      autoCameraRef.current &&
      didAutoFocusSeekerRef.current &&
      !isMapCameraBusy(map)
    ) {
      keepPublisherHandoffInView(
        map,
        {
          longitude: parkingLongitude,
          latitude: parkingLatitude,
        },
        { longitude: target.lng, latitude: target.lat },
        { reducedMotion: prefersReducedMotion() },
      );
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
      {compactChrome ? (
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
          {showUpdated ? (
            <p
              className="text-xs text-muted"
              data-testid="publisher-live-updated"
            >
              {updatedLabel}
            </p>
          ) : (
            <p className="text-xs text-muted" data-testid="publisher-live-legend">
              {hasKnownSeeker ? "Parking spot · Approaching driver" : "Parking spot"}
            </p>
          )}
          {progressLabel ? (
            <p
              className="text-xs font-medium text-foreground"
              data-testid="publisher-driver-distance"
            >
              {progressLabel}
            </p>
          ) : null}
          {pauseHint ? (
            <p
              className="basis-full text-xs text-muted"
              data-testid="publisher-live-pause-hint"
            >
              {pauseHint}
            </p>
          ) : null}
          <p className="sr-only" data-testid="publisher-live-status">
            {statusLabel}
          </p>
        </div>
      ) : (
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
            {hasKnownSeeker ? " · Approaching driver" : ""}
          </p>
        </div>
      )}

      <div
        className={[
          "relative w-full overflow-hidden rounded-[var(--radius-card)] border border-border",
          shellClass,
        ].join(" ")}
        aria-label={statusLabel}
        data-testid="publisher-live-progress-map"
        data-has-destination="true"
        data-has-seeker={hasKnownSeeker ? "true" : "false"}
        data-drag-pan="enabled"
        data-pinch-zoom="enabled"
        data-auto-camera={autoCamera ? "on" : "off"}
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
            if (initializedRef.current && map.getSource(DEST_SOURCE)) {
              setMapReady(true);
              return;
            }
            initializedRef.current = true;

            // Live tracking must never disable MapLibre gestures or pan inertia.
            applyMapDragPanInertia(map);
            map.touchZoomRotate.enable();
            map.scrollZoom.enable();
            map.keyboard.enable();
            map.doubleClickZoom.enable();

            const onUserGesture = (event: { originalEvent?: unknown }) => {
              if (!event?.originalEvent) {
                return;
              }
              pauseAutoCamera();
            };
            map.on("dragstart", onUserGesture);
            map.on("zoomstart", onUserGesture);
            map.on("rotatestart", onUserGesture);
            map.on("pitchstart", onUserGesture);
            // Wheel / trackpad zoom may not always carry through zoomstart the same way.
            map.getCanvas().addEventListener(
              "wheel",
              () => {
                pauseAutoCamera();
              },
              { passive: true },
            );

            registerSeekerMarkerImages(map);

            const knownSeeker = seekerRef.current;
            const live = collectionsForSeeker(knownSeeker);
            if (knownSeeker) {
              accuracyRef.current = knownSeeker.accuracyMeters;
            }

            map.addSource(DEST_SOURCE, {
              type: "geojson",
              data: pointCollection(parkingLongitude, parkingLatitude),
            });
            map.addSource(SEEKER_SOURCE, {
              type: "geojson",
              data: live.seeker,
            });
            map.addSource(ACCURACY_SOURCE, {
              type: "geojson",
              data: live.accuracy,
            });

            map.addLayer({
              id: ACCURACY_LAYER,
              type: "circle",
              source: ACCURACY_SOURCE,
              paint: {
                "circle-radius": ["get", "radiusPx"],
                "circle-color": PORCELAIN,
                "circle-stroke-color": SIGNAL_BLUE,
                "circle-stroke-width": 2,
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
                  "icon-anchor": "bottom",
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
                  "icon-size": 0.78,
                  "icon-anchor": "center",
                  "icon-allow-overlap": true,
                },
              });
            } else {
              addSeekerDisplayLayer(map);
            }

            map.resize();
            pendingFocusRef.current = true;
            setMapReady(true);
          }}
        />
        {!autoCamera ? (
          <CurrentLocationControl
            variant="embedded"
            data-testid="publisher-handoff-focus"
            ariaLabel={
              seekerLocation
                ? "Recenter on the approaching driver and parking spot"
                : "Recenter on the parking spot"
            }
            onClick={focusHandoff}
          />
        ) : null}
      </div>

      {onExpandedChange ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="motion-interactive-press min-h-10 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground"
            onClick={() => onExpandedChange(!expanded)}
            aria-expanded={expanded}
          >
            {expanded ? "Collapse map" : "Expand map"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
