"use client";

import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapGeoJSONFeature,
} from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";

import { BaseMap } from "@/components/map/BaseMap";
import { MapUnavailable } from "@/components/map/MapUnavailable";
import { SelectedSpotCard } from "@/components/map/SelectedSpotCard";
import { SpotDiscoveryCarousel } from "@/components/map/SpotDiscoveryCarousel";
import { Button } from "@/components/ui/Button";
import {
  MAP_FLOATING_CONTROL_CLASS,
  resolveDiscoveryBottomStack,
  syncDocumentMapBottomStack,
  type MapBottomStack,
} from "@/lib/map/bottom-stack";
import {
  formatDistanceAway,
  haversineDistanceMeters,
  isValidLatLng,
} from "@/lib/map/distance";
import { focusSelectedSpot } from "@/lib/map/focus-selected-spot";
import type { MapSpot } from "@/types/map-spot";

import {
  MAP_DEFAULT_CENTER_TEL_AVIV,
  MAP_DEFAULT_ZOOM,
  MAP_MOVEMENT_DURATION_MS,
  MAP_SELECTED_SPOT_ZOOM,
  MAP_LAYERS,
  MAP_SOURCES,
  assertMapTilerStyleUrlOrNull,
  isWithinSupportedMapBounds,
} from "@/lib/map/seekerMapConfig";
import {
  readSessionMapCamera,
  writeSessionMapCamera,
} from "@/lib/map/session-camera";
import {
  SEEKER_MARKER_IMAGE_IDS,
  SPOTS_ICON_IMAGE_EXPRESSION,
  registerSeekerMarkerImages,
} from "@/lib/map/seekerMarkerImages";
import { useUserLocation } from "@/lib/map/use-user-location";

type DestinationCoords = { latitude: number; longitude: number };

type ParkingMapMapLibreProps = {
  spots: MapSpot[];
  destination?: DestinationCoords | null;
  onVisuallyReady?: () => void;
  /** Hide discovery carousel during an active claim experience. */
  showDiscoveryCarousel?: boolean;
  /**
   * When set (active claim), overrides local discovery bottom-stack for
   * floating controls / toast clearance.
   */
  bottomStackOverride?: MapBottomStack | null;
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      window.setTimeout(() => {
        setReduced(false);
      }, 0);
      return;
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    // Safari fallback.
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  return reduced;
}

function createGeoJsonSpots(
  spots: MapSpot[],
  selectedId: string | null,
): GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; selected: boolean }> {
  return {
    type: "FeatureCollection",
    features: spots.map((spot) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [spot.longitude, spot.latitude] as [number, number],
      },
      properties: {
        id: spot.id,
        selected: selectedId !== null && spot.id === selectedId,
      },
    })),
  };
}

function emptyFeatureCollection(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function destinationFeatureCollection(
  destination: DestinationCoords,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [destination.longitude, destination.latitude],
        },
        properties: {},
      },
    ],
  };
}

function isValidDestination(
  destination: DestinationCoords | null | undefined,
): destination is DestinationCoords {
  return (
    !!destination &&
    Number.isFinite(destination.latitude) &&
    Number.isFinite(destination.longitude)
  );
}

/**
 * Order after style load:
 * 1) register marker images
 * 2) verify hasImage
 * 3) add GeoJSON sources
 * 4) add symbol layers
 */
function initializeSeekerMapLayers(
  map: MapLibreMap,
  spotsGeoJson: GeoJSON.FeatureCollection,
) {
  registerSeekerMarkerImages(map);

  if (!map.getSource(MAP_SOURCES.spots)) {
    map.addSource(MAP_SOURCES.spots, {
      type: "geojson",
      data: spotsGeoJson,
    });
  }

  if (!map.getLayer(MAP_LAYERS.spotsSymbols)) {
    map.addLayer({
      id: MAP_LAYERS.spotsSymbols,
      type: "symbol",
      source: MAP_SOURCES.spots,
      layout: {
        "icon-image": SPOTS_ICON_IMAGE_EXPRESSION,
        "icon-size": 1,
        "icon-allow-overlap": true,
      },
    });
  }
}

function ensureDestinationLayer(map: MapLibreMap, destination: DestinationCoords) {
  // Images must already be registered by initializeSeekerMapLayers.
  if (!map.hasImage(SEEKER_MARKER_IMAGE_IDS.destination)) {
    registerSeekerMarkerImages(map);
  }

  if (!map.getSource(MAP_SOURCES.destination)) {
    map.addSource(MAP_SOURCES.destination, {
      type: "geojson",
      data: destinationFeatureCollection(destination),
    });
  } else {
    const source = map.getSource(MAP_SOURCES.destination);
    if (source && source.type === "geojson") {
      (source as GeoJSONSource).setData(destinationFeatureCollection(destination));
    }
  }

  if (!map.getLayer(MAP_LAYERS.destination)) {
    map.addLayer({
      id: MAP_LAYERS.destination,
      type: "symbol",
      source: MAP_SOURCES.destination,
      layout: {
        "icon-image": SEEKER_MARKER_IMAGE_IDS.destination,
        "icon-size": 1,
        "icon-allow-overlap": true,
      },
    });
  }
}

function clearDestinationLayer(map: MapLibreMap) {
  const source = map.getSource(MAP_SOURCES.destination);
  if (source && source.type === "geojson") {
    (source as GeoJSONSource).setData(emptyFeatureCollection());
  }
}

function haversineApproxDegDeltaFromMeters(lat: number, meters: number) {
  const metersPerDegLat = 111_320;
  return meters / metersPerDegLat;
}

function metersToPixels(map: MapLibreMap, lng: number, lat: number, m: number) {
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

export function ParkingMapMapLibre({
  spots,
  destination = null,
  onVisuallyReady,
  showDiscoveryCarousel = true,
  bottomStackOverride = null,
}: ParkingMapMapLibreProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const mapTilerStyleUrl = useMemo(
    () => assertMapTilerStyleUrlOrNull(),
    [],
  );

  const styleFallback = mapTilerStyleUrl === null;
  const sessionCamera = readSessionMapCamera("seeker");
  const initialCenter: [number, number] = sessionCamera?.center ?? [
    MAP_DEFAULT_CENTER_TEL_AVIV.lng,
    MAP_DEFAULT_CENTER_TEL_AVIV.lat,
  ];
  const initialZoom = sessionCamera?.zoom ?? MAP_DEFAULT_ZOOM;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [mapVisuallyReady, setMapVisuallyReady] = useState(false);
  const [dismissedLocationNoticeKey, setDismissedLocationNoticeKey] = useState<
    string | null
  >(null);
  const onVisuallyReadyRef = useRef(onVisuallyReady);

  // Reconcile selection when Realtime refresh removes the spot from props.
  if (selectedId && !spots.some((spot) => spot.id === selectedId)) {
    setSelectedId(null);
  }

  useEffect(() => {
    onVisuallyReadyRef.current = onVisuallyReady;
  }, [onVisuallyReady]);

  const markVisuallyReady = () => {
    setMapVisuallyReady(true);
    onVisuallyReadyRef.current?.();
  };
  const selectedSpot = useMemo(() => {
    if (!selectedId) {
      return null;
    }
    return spots.find((s) => s.id === selectedId) ?? null;
  }, [selectedId, spots]);

  const showCarousel =
    mapVisuallyReady &&
    showDiscoveryCarousel &&
    spots.length > 0 &&
    !selectedSpot;

  const discoveryBottomStack = resolveDiscoveryBottomStack({
    hasSpots: showDiscoveryCarousel && spots.length > 0,
    hasSelected: Boolean(selectedSpot),
  });
  const bottomStack: MapBottomStack =
    bottomStackOverride ?? discoveryBottomStack;

  useEffect(() => {
    if (bottomStackOverride) {
      // Claim overlay owns document sync from SeekerMapExperience.
      return;
    }
    syncDocumentMapBottomStack(bottomStack);
    return () => {
      syncDocumentMapBottomStack(null);
    };
  }, [bottomStack, bottomStackOverride]);

  const { state: userLocation } = useUserLocation({
    enableHighAccuracy: true,
    watch: true,
    timeoutMs: 10_000,
    maximumAgeMs: 60_000,
  });

  const [followMode, setFollowMode] = useState(false);
  const hasCenteredOnUserOnceRef = useRef(false);

  const mapRef = useRef<MapLibreMap | null>(null);
  const hasInitializedLayersRef = useRef(false);
  const hasInitialDestinationViewRef = useRef(false);
  const userLayersAddedRef = useRef(false);
  const interactionHandlersBoundRef = useRef(false);
  const lastFocusedSpotIdRef = useRef<string | null>(null);

  const disableFollowOnUserMove = () => {
    setFollowMode(false);
  };

  const locationFailure =
    userLocation.status === "denied" ||
    userLocation.status === "unavailable" ||
    userLocation.status === "timeout" ||
    userLocation.status === "unsupported";

  const locationOutsideSupportedArea =
    userLocation.status === "ready" &&
    !isWithinSupportedMapBounds(
      userLocation.longitude,
      userLocation.latitude,
    );

  const locationNoticeKey = `${userLocation.status}:${String(mapVisuallyReady)}`;
  const locationNoticeHidden = dismissedLocationNoticeKey === locationNoticeKey;
  const showLocationNotice =
    mapVisuallyReady &&
    !locationNoticeHidden &&
    (userLocation.status === "loading" ||
      locationFailure ||
      locationOutsideSupportedArea);

  useEffect(() => {
    if (!showLocationNotice) {
      return;
    }
    const id = window.setTimeout(() => {
      setDismissedLocationNoticeKey(locationNoticeKey);
    }, 6000);
    return () => window.clearTimeout(id);
  }, [showLocationNotice, locationNoticeKey]);

  useEffect(() => {
    if (userLocation.status !== "ready" || hasCenteredOnUserOnceRef.current) {
      return;
    }
    hasCenteredOnUserOnceRef.current = true;
    // Only auto-follow when the fix is inside the supported product area.
    if (
      !isWithinSupportedMapBounds(
        userLocation.longitude,
        userLocation.latitude,
      )
    ) {
      return;
    }
    // Defer so we don't cascade render synchronously inside the effect.
    const id = window.setTimeout(() => {
      setFollowMode(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [userLocation]);

  const spotsGeoJson = useMemo(
    () => createGeoJsonSpots(spots, selectedId),
    [spots, selectedId],
  );

  useEffect(() => {
    if (!selectedId) {
      lastFocusedSpotIdRef.current = null;
      return;
    }
    if (!selectedSpot || !mapRef.current || !hasInitializedLayersRef.current) {
      return;
    }
    if (lastFocusedSpotIdRef.current === selectedId) {
      return;
    }
    lastFocusedSpotIdRef.current = selectedId;
    setFollowMode(false);
    focusSelectedSpot(mapRef.current, {
      longitude: selectedSpot.longitude,
      latitude: selectedSpot.latitude,
      offsetY: -112,
      durationMs: prefersReducedMotion ? 0 : MAP_MOVEMENT_DURATION_MS,
    });
  }, [selectedId, selectedSpot, prefersReducedMotion, mapVisuallyReady]);

  useEffect(() => {
    if (!mapRef.current || !hasInitializedLayersRef.current) {
      return;
    }
    const source = mapRef.current.getSource(MAP_SOURCES.spots);
    if (!source || source.type !== "geojson") {
      return;
    }
    (source as GeoJSONSource).setData(spotsGeoJson);
  }, [spotsGeoJson]);

  useEffect(() => {
    if (!mapRef.current || !hasInitializedLayersRef.current) {
      return;
    }

    const map = mapRef.current;

    if (!isValidDestination(destination)) {
      clearDestinationLayer(map);
      return;
    }

    ensureDestinationLayer(map, destination);
  }, [destination]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isValidDestination(destination)) {
      return;
    }
    if (hasInitialDestinationViewRef.current) {
      return;
    }

    const destinationInBounds = isWithinSupportedMapBounds(
      destination.longitude,
      destination.latitude,
    );

    // Unexpected out-of-area destination: keep default Tel Aviv view, no loop.
    if (!destinationInBounds) {
      hasInitialDestinationViewRef.current = true;
      return;
    }

    const userReadyInBounds =
      userLocation.status === "ready" &&
      isWithinSupportedMapBounds(
        userLocation.longitude,
        userLocation.latitude,
      );

    if (userReadyInBounds) {
      const bounds = [
        [userLocation.longitude, userLocation.latitude],
        [destination.longitude, destination.latitude],
      ] as [[number, number], [number, number]];

      map.fitBounds(bounds, {
        padding: 80,
        maxZoom: MAP_SELECTED_SPOT_ZOOM,
        duration: prefersReducedMotion ? 0 : MAP_MOVEMENT_DURATION_MS,
        essential: true,
      });
    } else {
      map.easeTo({
        center: [destination.longitude, destination.latitude],
        zoom: MAP_SELECTED_SPOT_ZOOM,
        duration: prefersReducedMotion ? 0 : MAP_MOVEMENT_DURATION_MS,
        essential: true,
      });
    }

    hasInitialDestinationViewRef.current = true;
  }, [
    destination,
    prefersReducedMotion,
    userLocation,
  ]);

  useEffect(() => {
    if (!mapRef.current || !hasInitializedLayersRef.current) {
      return;
    }

    if (userLocation.status !== "ready") {
      // Geolocation is optional: do nothing until we have coordinates.
      return;
    }

    const map = mapRef.current;

    // Add user-location sources/layers only when location is ready.
    if (!userLayersAddedRef.current) {
      userLayersAddedRef.current = true;

      if (!map.getSource(MAP_SOURCES.userLocation)) {
        map.addSource(MAP_SOURCES.userLocation, {
          type: "geojson",
          data: emptyFeatureCollection(),
        });
      }

      if (!map.getSource(MAP_SOURCES.userAccuracy)) {
        map.addSource(MAP_SOURCES.userAccuracy, {
          type: "geojson",
          data: emptyFeatureCollection(),
        });
      }

      if (!map.getLayer(MAP_LAYERS.userAccuracy)) {
        map.addLayer({
          id: MAP_LAYERS.userAccuracy,
          type: "circle",
          source: MAP_SOURCES.userAccuracy,
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

      if (!map.getLayer(MAP_LAYERS.userDot)) {
        map.addLayer({
          id: MAP_LAYERS.userDot,
          type: "circle",
          source: MAP_SOURCES.userLocation,
          paint: {
            "circle-radius": 6,
            "circle-color": "#55bff3",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });
      }
    }

    const dotSource = map.getSource(MAP_SOURCES.userLocation);
    const ringSource = map.getSource(MAP_SOURCES.userAccuracy);
    if (!dotSource || !ringSource) {
      return;
    }
    if (dotSource.type !== "geojson" || ringSource.type !== "geojson") {
      return;
    }

    (dotSource as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [userLocation.longitude, userLocation.latitude],
          },
          properties: {},
        },
      ],
    });

    const radiusPx = metersToPixels(
      map,
      userLocation.longitude,
      userLocation.latitude,
      userLocation.accuracy ?? 0,
    );

    (ringSource as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [userLocation.longitude, userLocation.latitude],
          },
          properties: { radiusPx },
        },
      ],
    });

    const userInBounds = isWithinSupportedMapBounds(
      userLocation.longitude,
      userLocation.latitude,
    );

    // Follow only inside the supported area — never chase an out-of-bounds fix
    // (avoids maxBounds clamp loops without flipping React state here).
    if (followMode && userInBounds) {
      const center = map.getCenter();
      const px = map.project([userLocation.longitude, userLocation.latitude]);
      const pxCenter = map.project([center.lng, center.lat]);
      const dx = px.x - pxCenter.x;
      const dy = px.y - pxCenter.y;
      const distPx = Math.sqrt(dx * dx + dy * dy);

      if (distPx > 35) {
        map.easeTo({
          center: [userLocation.longitude, userLocation.latitude],
          duration: prefersReducedMotion ? 0 : 450,
          essential: true,
        });
      }
    }
  }, [userLocation, followMode, prefersReducedMotion]);

  if (styleFallback || mapUnavailable) {
    return (
      <div className="relative flex h-full w-full items-center justify-center p-4">
        <MapUnavailable />
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full"
      data-map-bottom={bottomStack}
      data-testid="parking-map-stage"
    >
      {mapVisuallyReady &&
      userLocation.status === "loading" &&
      !locationNoticeHidden ? (
        <div
          className={`${MAP_FLOATING_CONTROL_CLASS} z-[4]`}
          role="status"
          aria-live="polite"
        >
          <div
            data-testid="location-loading-pill"
            className="pointer-events-auto max-w-[11rem] rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs text-muted shadow-[var(--shadow-card)] motion-fade-in"
          >
            Finding location…
          </div>
        </div>
      ) : null}

      {mapVisuallyReady && locationFailure && !locationNoticeHidden ? (
        <div
          className={`${MAP_FLOATING_CONTROL_CLASS} z-[4]`}
          role="status"
          aria-live="polite"
        >
          <div
            data-testid="location-unavailable-pill"
            className="pointer-events-auto max-w-[12.5rem] rounded-full border border-border bg-surface/95 px-3 py-1.5 text-left shadow-[var(--shadow-card)] motion-fade-in"
          >
            <p className="text-xs font-medium text-foreground">
              Location unavailable
            </p>
            <p className="text-[0.65rem] leading-4 text-muted">
              You can still browse the map.
            </p>
          </div>
        </div>
      ) : null}

      {mapVisuallyReady &&
      locationOutsideSupportedArea &&
      !locationNoticeHidden ? (
        <div
          className={`${MAP_FLOATING_CONTROL_CLASS} z-[4]`}
          role="status"
          aria-live="polite"
        >
          <div
            data-testid="location-outside-pill"
            className="pointer-events-auto max-w-[12.5rem] rounded-full border border-border bg-surface/95 px-3 py-1.5 text-left shadow-[var(--shadow-card)] motion-fade-in"
          >
            <p className="text-xs font-medium text-foreground">
              Outside map area
            </p>
            <p className="text-[0.65rem] leading-4 text-muted">
              Browsing Tel Aviv.
            </p>
          </div>
        </div>
      ) : null}

      <div className="absolute inset-0 z-0 h-full w-full">
          <BaseMap
            styleUrl={mapTilerStyleUrl!}
            center={initialCenter}
            zoom={initialZoom}
            className="absolute inset-0 h-full w-full"
            onMapUnavailable={() => setMapUnavailable(true)}
            onVisuallyReady={markVisuallyReady}
            onMapReady={(map) => {
            mapRef.current = map;

            if (hasInitializedLayersRef.current) {
              return;
            }

            try {
              // Style is already loaded (BaseMap waits for "load").
              initializeSeekerMapLayers(map, spotsGeoJson);

              if (isValidDestination(destination)) {
                ensureDestinationLayer(map, destination);
              }

              if (!interactionHandlersBoundRef.current) {
                interactionHandlersBoundRef.current = true;

                map.on("click", MAP_LAYERS.spotsSymbols, (e) => {
                  const feature = e.features?.[0] as
                    | MapGeoJSONFeature
                    | undefined;
                  const id = feature?.properties?.["id"];
                  if (typeof id !== "string") {
                    return;
                  }

                  setFollowMode(false);
                  setSelectedId((prev) => (prev === id ? prev : id));
                });

                map.on("mouseenter", MAP_LAYERS.spotsSymbols, () => {
                  map.getCanvas().style.cursor = "pointer";
                });
                map.on("mouseleave", MAP_LAYERS.spotsSymbols, () => {
                  map.getCanvas().style.cursor = "";
                });

                map.on("dragstart", disableFollowOnUserMove);
                map.on("touchstart", disableFollowOnUserMove);
                map.on("zoomstart", disableFollowOnUserMove);

                map.on("moveend", () => {
                  const center = map.getCenter();
                  writeSessionMapCamera("seeker", {
                    center: [center.lng, center.lat],
                    zoom: map.getZoom(),
                  });
                });
              }

              hasInitializedLayersRef.current = true;
            } catch (error) {
              if (process.env.NODE_ENV === "development") {
                const message =
                  error instanceof Error ? error.message : "layer init failed";
                console.error("[map] Seeker layer init failed:", message);
              }
            }
          }}
        />
      </div>

      {mapVisuallyReady &&
      userLocation.status === "ready" &&
      isWithinSupportedMapBounds(
        userLocation.longitude,
        userLocation.latitude,
      ) ? (
        <div
          className={MAP_FLOATING_CONTROL_CLASS}
          data-testid="map-recenter-control"
          data-map-bottom={bottomStack}
        >
          <Button
            type="button"
            variant="secondary"
            className="rounded-full border border-border bg-surface px-3.5 py-2.5 shadow-[var(--shadow-card)]"
            onClick={() => {
              const map = mapRef.current;
              if (
                !map ||
                userLocation.status !== "ready" ||
                !isWithinSupportedMapBounds(
                  userLocation.longitude,
                  userLocation.latitude,
                )
              ) {
                return;
              }
              setFollowMode(true);
              map.easeTo({
                center: [userLocation.longitude, userLocation.latitude],
                zoom: map.getZoom(),
                duration: prefersReducedMotion ? 0 : 550,
                essential: true,
              });
            }}
            aria-label="Recenter on my location"
          >
            Recenter
          </Button>
        </div>
      ) : null}

      {showCarousel ? (
        <SpotDiscoveryCarousel
          spots={spots}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId((prev) => (prev === id ? prev : id));
          }}
          userLocation={
            userLocation.status === "ready"
              ? {
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude,
                }
              : null
          }
        />
      ) : null}

      {mapVisuallyReady && selectedSpot && showDiscoveryCarousel ? (
        <SelectedSpotCard
          spot={selectedSpot}
          onClose={() => setSelectedId(null)}
          distanceLabel={
            userLocation.status === "ready" &&
            isValidLatLng({
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            })
              ? formatDistanceAway(
                  haversineDistanceMeters(
                    {
                      latitude: userLocation.latitude,
                      longitude: userLocation.longitude,
                    },
                    {
                      latitude: selectedSpot.latitude,
                      longitude: selectedSpot.longitude,
                    },
                  ),
                ) || null
              : null
          }
        />
      ) : null}
    </div>
  );
}

// Adapter export so `ParkingMapLoader` can switch engines by changing only the import path.
export function ParkingMap(props: ParkingMapMapLibreProps) {
  return <ParkingMapMapLibre {...props} />;
}
