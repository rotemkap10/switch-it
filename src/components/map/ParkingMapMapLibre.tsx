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
import { useReportInitialMapReady } from "@/components/shell/AppLaunchReadyContext";
import {
  CurrentLocationControl,
  CurrentLocationUnavailableNotice,
} from "@/components/map/CurrentLocationControl";
import { centerMapOnLocation } from "@/lib/map/center-on-location";
import type { DeviceLocationFix } from "@/lib/map/request-current-device-location";
import {
  SEEKER_USER_LOCATION_IDS,
  syncUserLocationDot,
} from "@/lib/map/user-location-dot";
import { watchBestDeviceLocation } from "@/lib/map/watch-best-device-location";
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion";
import {
  MAP_FLOATING_CONTROL_CLASS,
  resolveDiscoveryBottomStack,
  syncDocumentMapBottomStack,
  type MapBottomStack,
} from "@/lib/map/bottom-stack";
import {
  formatClaimDistanceLabel,
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
  clearSessionMapCamera,
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

function isUserMapGesture(event: { originalEvent?: unknown } | undefined): boolean {
  return Boolean(event?.originalEvent);
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

export function ParkingMapMapLibre({
  spots,
  destination = null,
  onVisuallyReady,
  showDiscoveryCarousel = true,
  bottomStackOverride = null,
}: ParkingMapMapLibreProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const reportInitialMapReady = useReportInitialMapReady();
  const mapTilerStyleUrl = useMemo(
    () => assertMapTilerStyleUrlOrNull(),
    [],
  );

  const styleFallback = mapTilerStyleUrl === null;
  const initialCenter: [number, number] = [
    MAP_DEFAULT_CENTER_TEL_AVIV.lng,
    MAP_DEFAULT_CENTER_TEL_AVIV.lat,
  ];
  const initialZoom = MAP_DEFAULT_ZOOM;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [mapInstanceKey, setMapInstanceKey] = useState(0);
  const [mapVisuallyReady, setMapVisuallyReady] = useState(false);
  const [dismissedLocationNoticeKey, setDismissedLocationNoticeKey] = useState<
    string | null
  >(null);
  const onVisuallyReadyRef = useRef(onVisuallyReady);

  useEffect(() => {
    if (styleFallback || mapUnavailable) {
      reportInitialMapReady();
    }
  }, [styleFallback, mapUnavailable, reportInitialMapReady]);

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

  const { state: userLocation, applyFreshFix, applyError } = useUserLocation({
    autoRequest: false,
  });

  const [recenterNoticeVisible, setRecenterNoticeVisible] = useState(false);
  const [layersReady, setLayersReady] = useState(false);

  const mapRef = useRef<MapLibreMap | null>(null);
  const hasInitializedLayersRef = useRef(false);
  const hasInitialDestinationViewRef = useRef(false);
  const interactionHandlersBoundRef = useRef(false);
  const lastFocusedSpotIdRef = useRef<string | null>(null);
  const userMovedMapRef = useRef(false);
  const autoCenterGenerationRef = useRef(0);
  const pendingAutoCenterFixRef = useRef<DeviceLocationFix | null>(null);
  const lastKnownFixRef = useRef<DeviceLocationFix | null>(null);
  const pendingExplicitRecenterFixRef = useRef<DeviceLocationFix | null>(null);
  const explicitRecenterSeqRef = useRef(0);
  const stopExplicitRecenterWatchRef = useRef<(() => void) | null>(null);
  const [recenterPending, setRecenterPending] = useState(false);
  const prefersReducedMotionRef = useRef(prefersReducedMotion);
  const applyFreshFixRef = useRef(applyFreshFix);
  const applyErrorRef = useRef(applyError);

  useEffect(() => {
    prefersReducedMotionRef.current = prefersReducedMotion;
  }, [prefersReducedMotion]);

  useEffect(() => {
    applyFreshFixRef.current = applyFreshFix;
  }, [applyFreshFix]);

  useEffect(() => {
    applyErrorRef.current = applyError;
  }, [applyError]);

  const markUserMovedMap = () => {
    userMovedMapRef.current = true;
    autoCenterGenerationRef.current += 1;
    pendingAutoCenterFixRef.current = null;
  };

  const tryAutoCenterOnFix = (fix: DeviceLocationFix, generation: number) => {
    if (generation !== autoCenterGenerationRef.current) {
      return;
    }
    if (userMovedMapRef.current) {
      return;
    }
    if (!isWithinSupportedMapBounds(fix.longitude, fix.latitude)) {
      return;
    }

    const map = mapRef.current;
    if (!map || !hasInitializedLayersRef.current) {
      pendingAutoCenterFixRef.current = fix;
      return;
    }

    pendingAutoCenterFixRef.current = null;
    centerMapOnLocation(map, fix.longitude, fix.latitude, {
      reducedMotion: prefersReducedMotionRef.current,
    });
  };

  const centerFindMapOnFix = (fix: DeviceLocationFix): boolean => {
    const map = mapRef.current;
    if (!map || !hasInitializedLayersRef.current) {
      pendingExplicitRecenterFixRef.current = fix;
      return false;
    }

    pendingExplicitRecenterFixRef.current = null;
    if (typeof map.stop === "function") {
      map.stop();
    }
    centerMapOnLocation(map, fix.longitude, fix.latitude, {
      reducedMotion: prefersReducedMotionRef.current,
    });
    return true;
  };

  const applyExplicitRecenterFix = (fix: DeviceLocationFix) => {
    // Explicit Current Location always wins over pan / auto-center guards.
    autoCenterGenerationRef.current += 1;
    pendingAutoCenterFixRef.current = null;
    lastKnownFixRef.current = fix;
    applyFreshFixRef.current(fix);
    setRecenterNoticeVisible(false);
    centerFindMapOnFix(fix);
  };

  const handleCurrentLocationClick = () => {
    const seq = ++explicitRecenterSeqRef.current;
    setRecenterNoticeVisible(false);

    const known = lastKnownFixRef.current;
    if (known) {
      applyExplicitRecenterFix(known);
    }

    stopExplicitRecenterWatchRef.current?.();
    setRecenterPending(true);
    stopExplicitRecenterWatchRef.current = watchBestDeviceLocation({
      onUpdate: (fix) => {
        if (seq !== explicitRecenterSeqRef.current) {
          return;
        }
        applyExplicitRecenterFix(fix);
      },
      onError: () => {
        if (seq !== explicitRecenterSeqRef.current) {
          return;
        }
        setRecenterPending(false);
        if (!lastKnownFixRef.current) {
          setRecenterNoticeVisible(true);
        }
      },
      onSettled: () => {
        if (seq !== explicitRecenterSeqRef.current) {
          return;
        }
        setRecenterPending(false);
      },
    });
  };

  useEffect(() => {
    if (!recenterNoticeVisible) {
      return;
    }
    const id = window.setTimeout(() => {
      setRecenterNoticeVisible(false);
    }, 6000);
    return () => window.clearTimeout(id);
  }, [recenterNoticeVisible]);

  useEffect(() => {
    const watchGeneration = autoCenterGenerationRef.current;
    const stop = watchBestDeviceLocation({
      onUpdate: (fix) => {
        lastKnownFixRef.current = fix;
        applyFreshFixRef.current(fix);
        tryAutoCenterOnFix(fix, watchGeneration);
      },
      onError: (reason) => {
        applyErrorRef.current(reason);
      },
    });
    return () => {
      stop();
      stopExplicitRecenterWatchRef.current?.();
      clearSessionMapCamera("seeker");
    };
  }, []);

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
    markUserMovedMap();
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
    if (!layersReady) {
      return;
    }

    const map = mapRef.current;
    if (!map || !hasInitializedLayersRef.current) {
      return;
    }

    if (userLocation.status !== "ready") {
      syncUserLocationDot(map, SEEKER_USER_LOCATION_IDS, null);
      return;
    }

    syncUserLocationDot(map, SEEKER_USER_LOCATION_IDS, {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      accuracy: userLocation.accuracy,
    });
  }, [userLocation, layersReady]);

  if (styleFallback) {
    return (
      <div className="relative flex h-full w-full items-center justify-center p-4">
        <MapUnavailable reason="configuration" />
      </div>
    );
  }

  if (mapUnavailable) {
    return (
      <div className="relative flex h-full w-full items-center justify-center p-4">
        <MapUnavailable
          reason="temporary"
          onRetry={() => {
            hasInitializedLayersRef.current = false;
            interactionHandlersBoundRef.current = false;
            setLayersReady(false);
            setMapVisuallyReady(false);
            setMapUnavailable(false);
            setMapInstanceKey((key) => key + 1);
          }}
        />
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
            key={mapInstanceKey}
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

                  setSelectedId((prev) => (prev === id ? prev : id));
                });

                map.on("mouseenter", MAP_LAYERS.spotsSymbols, () => {
                  map.getCanvas().style.cursor = "pointer";
                });
                map.on("mouseleave", MAP_LAYERS.spotsSymbols, () => {
                  map.getCanvas().style.cursor = "";
                });

                map.on("dragstart", (event) => {
                  if (isUserMapGesture(event)) {
                    markUserMovedMap();
                  }
                });
                map.on("zoomstart", (event) => {
                  if (isUserMapGesture(event)) {
                    markUserMovedMap();
                  }
                });

                map.on("moveend", () => {
                  const center = map.getCenter();
                  writeSessionMapCamera("seeker", {
                    center: [center.lng, center.lat],
                    zoom: map.getZoom(),
                  });
                });
              }

              hasInitializedLayersRef.current = true;
              setLayersReady(true);

              const pendingExplicit = pendingExplicitRecenterFixRef.current;
              if (pendingExplicit) {
                centerFindMapOnFix(pendingExplicit);
              } else {
                const pendingFix = pendingAutoCenterFixRef.current;
                if (pendingFix) {
                  tryAutoCenterOnFix(
                    pendingFix,
                    autoCenterGenerationRef.current,
                  );
                }
              }
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

      {mapVisuallyReady ? (
        <CurrentLocationControl
          variant="floating"
          data-testid="map-recenter-control"
          pending={recenterPending}
          disableWhenPending={false}
          onClick={handleCurrentLocationClick}
        />
      ) : null}

      {mapVisuallyReady && recenterNoticeVisible ? (
        <CurrentLocationUnavailableNotice
          onDismiss={() => setRecenterNoticeVisible(false)}
        />
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
          seekerLocation={
            userLocation.status === "ready" &&
            isValidLatLng({
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            })
              ? {
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude,
                }
              : null
          }
          distanceLabel={
            userLocation.status === "ready" &&
            isValidLatLng({
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            })
              ? formatClaimDistanceLabel(
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
