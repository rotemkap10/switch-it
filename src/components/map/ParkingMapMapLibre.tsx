"use client";

import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapGeoJSONFeature,
} from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  acquireSharedForegroundLocation,
  peekTrustedSharedForegroundFix,
  subscribeSharedForegroundLocation,
  waitForTrustedSharedForegroundFix,
} from "@/lib/map/shared-foreground-location";
import { isMateriallyDifferentFix } from "@/lib/map/trusted-foreground-fix";
import {
  SEEKER_USER_LOCATION_IDS,
  syncUserLocationDot,
} from "@/lib/map/user-location-dot";
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
import { logMapInteractionSnapshot } from "@/lib/map/log-map-interaction-snapshot";
import type { MapSpot } from "@/types/map-spot";

import {
  MAP_DEFAULT_ZOOM,
  MAP_MOVEMENT_DURATION_MS,
  MAP_SELECTED_SPOT_ZOOM,
  MAP_LAYERS,
  MAP_SOURCES,
  assertMapTilerStyleUrlOrNull,
  isWithinSupportedMapBounds,
} from "@/lib/map/seekerMapConfig";
import {
  INITIAL_MAP_LOCATION_WAIT_MS,
  resolveInitialMapCenterLngLat,
} from "@/lib/map/resolve-initial-map-camera";
import { MapLoadingState } from "@/components/map/MapLoadingState";
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

export type ParkingMapMode = "browse" | "picker";

export type PickerExternalRecenter = {
  requestId: number;
  latitude: number;
  longitude: number;
  /** One-shot camera zoom for address search. Omitted = preserve/fallback. */
  zoom?: number;
};

/** Exact BaseMap className for Find Parking and Share a Spot. */
export const PARKING_MAP_BASEMAP_CLASS = "absolute inset-0 h-full w-full";

const COORD_EPSILON = 1e-7;
const PICKER_LOCATION_SELECTED_MS = 1600;

function coordsNearlyEqual(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): boolean {
  return (
    Math.abs(aLat - bLat) < COORD_EPSILON &&
    Math.abs(aLng - bLng) < COORD_EPSILON
  );
}

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
  /**
   * `browse` is Find Parking. `picker` is Share a Spot — same MapLibre
   * path, plus a center pin and observe-only moveend coordinates.
   */
  mode?: ParkingMapMode;
  pickerDisabled?: boolean;
  onPickerLocationChange?: (latitude: number, longitude: number) => void;
  onPickerInteractionStart?: () => void;
  onPickerInteractionSettled?: () => void;
  onPickerUserMovedMap?: () => void;
  onPickerCurrentLocationRequested?: () => void;
  onPickerCurrentLocationResolved?: (fix: DeviceLocationFix) => void;
  /** Address-search (or other explicit) camera command. Ignored for map-originated coords. */
  pickerExternalRecenter?: PickerExternalRecenter | null;
  /**
   * Share a Spot chrome: `card` is the legacy inset picker; `fullscreen`
   * fills the map stage and clears floating controls for the compose sheet.
   */
  pickerLayout?: "card" | "fullscreen";
  /**
   * Known form coordinates for Share a Spot (GPS or choose-on-map seed).
   * Does not draw a destination marker. Trusted GPS still wins when present.
   */
  seedCenter?: DestinationCoords | null;
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
        "icon-anchor": "bottom",
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
  mode = "browse",
  pickerDisabled = false,
  onPickerLocationChange,
  onPickerInteractionStart,
  onPickerInteractionSettled,
  onPickerUserMovedMap,
  onPickerCurrentLocationRequested,
  onPickerCurrentLocationResolved,
  pickerExternalRecenter = null,
  pickerLayout = "card",
  seedCenter = null,
}: ParkingMapMapLibreProps) {
  const isPicker = mode === "picker";
  const isFullscreenPicker = isPicker && pickerLayout === "fullscreen";
  const prefersReducedMotion = usePrefersReducedMotion();
  const reportInitialMapReady = useReportInitialMapReady();
  const mapTilerStyleUrl = useMemo(
    () => assertMapTilerStyleUrlOrNull(),
    [],
  );

  const styleFallback = mapTilerStyleUrl === null;
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(
    () => {
      if (isValidDestination(destination)) {
        return resolveInitialMapCenterLngLat({ destination });
      }
      const existing = peekTrustedSharedForegroundFix();
      if (existing) {
        return resolveInitialMapCenterLngLat({ trustedFix: existing });
      }
      if (isValidDestination(seedCenter)) {
        return resolveInitialMapCenterLngLat({ seedCenter });
      }
      return null;
    },
  );
  const initialZoom = MAP_DEFAULT_ZOOM;
  const awaitingInitialCamera = initialCenter == null;

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

  // Prefer known destination / seed without flashing a default city.
  if (initialCenter == null && isValidDestination(destination)) {
    setInitialCenter(resolveInitialMapCenterLngLat({ destination }));
  } else if (initialCenter == null && isValidDestination(seedCenter)) {
    setInitialCenter(resolveInitialMapCenterLngLat({ seedCenter }));
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
  const pickerBottomStack: MapBottomStack = isFullscreenPicker
    ? "compose"
    : "none";
  const stageBottomStack: MapBottomStack = isPicker
    ? pickerBottomStack
    : bottomStack;

  useEffect(() => {
    if (isPicker) {
      if (!isFullscreenPicker) {
        return;
      }
      syncDocumentMapBottomStack("compose");
      return () => {
        syncDocumentMapBottomStack(null);
      };
    }
    if (bottomStackOverride) {
      // Claim overlay owns document sync from SeekerMapExperience.
      return;
    }
    syncDocumentMapBottomStack(bottomStack);
    return () => {
      syncDocumentMapBottomStack(null);
    };
  }, [bottomStack, bottomStackOverride, isFullscreenPicker, isPicker]);

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
  const pinRef = useRef<HTMLDivElement | null>(null);
  const userGestureActiveRef = useRef(false);
  const lastPickerCommitRef = useRef<{ lat: number; lng: number } | null>(
    null,
  );
  const lastExternalRecenterIdRef = useRef(0);
  const pendingPickerExternalRecenterRef = useRef<PickerExternalRecenter | null>(
    null,
  );
  const [showPickerSelectedHint, setShowPickerSelectedHint] = useState(false);
  const pickerCallbacksRef = useRef({
    onPickerLocationChange,
    onPickerInteractionStart,
    onPickerInteractionSettled,
    onPickerUserMovedMap,
    onPickerCurrentLocationRequested,
    onPickerCurrentLocationResolved,
  });
  const pickerDisabledRef = useRef(pickerDisabled);

  useEffect(() => {
    prefersReducedMotionRef.current = prefersReducedMotion;
  }, [prefersReducedMotion]);

  useEffect(() => {
    applyFreshFixRef.current = applyFreshFix;
  }, [applyFreshFix]);

  useEffect(() => {
    applyErrorRef.current = applyError;
  }, [applyError]);

  useEffect(() => {
    pickerCallbacksRef.current = {
      onPickerLocationChange,
      onPickerInteractionStart,
      onPickerInteractionSettled,
      onPickerUserMovedMap,
      onPickerCurrentLocationRequested,
      onPickerCurrentLocationResolved,
    };
  }, [
    onPickerLocationChange,
    onPickerInteractionStart,
    onPickerInteractionSettled,
    onPickerUserMovedMap,
    onPickerCurrentLocationRequested,
    onPickerCurrentLocationResolved,
  ]);

  useEffect(() => {
    pickerDisabledRef.current = pickerDisabled;
  }, [pickerDisabled]);

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
    const moved = centerFindMapOnFix(fix);
    if (moved && process.env.NODE_ENV === "development") {
      const map = mapRef.current;
      map?.once("moveend", () => {
        logMapInteractionSnapshot(isPicker ? "share-spot" : "find-parking", map);
      });
    }
    if (isPicker) {
      pickerCallbacksRef.current.onPickerCurrentLocationResolved?.(fix);
    }
  };

  const handleCurrentLocationClick = () => {
    if (isPicker) {
      pickerCallbacksRef.current.onPickerCurrentLocationRequested?.();
    }
    const seq = ++explicitRecenterSeqRef.current;
    setRecenterNoticeVisible(false);

    const immediate = peekTrustedSharedForegroundFix();
    if (immediate) {
      applyExplicitRecenterFix(immediate);
    }

    stopExplicitRecenterWatchRef.current?.();
    setRecenterPending(true);
    let cancelled = false;
    stopExplicitRecenterWatchRef.current = () => {
      cancelled = true;
    };

    void (async () => {
      const result = immediate
        ? await waitForTrustedSharedForegroundFix("find-parking-recenter-refine", {
            timeoutMs: 2_500,
            afterFix: immediate,
          })
        : await waitForTrustedSharedForegroundFix("find-parking-recenter", {
            timeoutMs: 12_000,
          });

      if (cancelled || seq !== explicitRecenterSeqRef.current) {
        return;
      }
      setRecenterPending(false);
      if (!result.ok) {
        if (!lastKnownFixRef.current && !immediate) {
          setRecenterNoticeVisible(true);
        }
        return;
      }
      if (
        !immediate ||
        result.fix.timestamp > immediate.timestamp ||
        isMateriallyDifferentFix(result.fix, immediate)
      ) {
        applyExplicitRecenterFix(result.fix);
      }
    })();
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

  const applyPickerExternalRecenter = useCallback(
    (command: PickerExternalRecenter) => {
      const map = mapRef.current;
      if (!map || !hasInitializedLayersRef.current) {
        pendingPickerExternalRecenterRef.current = command;
        return;
      }
      pendingPickerExternalRecenterRef.current = null;
      lastExternalRecenterIdRef.current = command.requestId;
      userMovedMapRef.current = true;
      autoCenterGenerationRef.current += 1;
      pendingAutoCenterFixRef.current = null;
      if (typeof map.stop === "function") {
        map.stop();
      }
      centerMapOnLocation(map, command.longitude, command.latitude, {
        reducedMotion: prefersReducedMotionRef.current,
        ...(command.zoom != null && Number.isFinite(command.zoom)
          ? { zoom: command.zoom }
          : {}),
      });
    },
    [],
  );

  useEffect(() => {
    if (!isPicker || !pickerExternalRecenter) {
      return;
    }
    if (pickerExternalRecenter.requestId === lastExternalRecenterIdRef.current) {
      return;
    }
    applyPickerExternalRecenter(pickerExternalRecenter);
  }, [applyPickerExternalRecenter, isPicker, pickerExternalRecenter]);

  useEffect(() => {
    if (!showPickerSelectedHint) {
      return;
    }
    const id = window.setTimeout(() => {
      setShowPickerSelectedHint(false);
    }, PICKER_LOCATION_SELECTED_MS);
    return () => window.clearTimeout(id);
  }, [showPickerSelectedHint]);

  useEffect(() => {
    const watchGeneration = autoCenterGenerationRef.current;
    const release = acquireSharedForegroundLocation("find-parking");

    const applyTrusted = (fix: DeviceLocationFix) => {
      lastKnownFixRef.current = fix;
      applyFreshFixRef.current(fix);
      tryAutoCenterOnFix(fix, watchGeneration);
    };

    const existing = peekTrustedSharedForegroundFix();
    if (existing) {
      applyTrusted(existing);
    }

    const unsub = subscribeSharedForegroundLocation((snap) => {
      if (snap.trustedFix) {
        applyTrusted(snap.trustedFix);
        return;
      }
      if (snap.status === "error" && snap.error) {
        applyErrorRef.current(snap.error);
      }
    });

    return () => {
      unsub();
      release();
      stopExplicitRecenterWatchRef.current?.();
      clearSessionMapCamera("seeker");
    };
  }, []);

  // Gate BaseMap until we have a meaningful first center (GPS or timeout).
  useEffect(() => {
    if (initialCenter != null) {
      return;
    }

    let settled = false;
    const finish = (fix: DeviceLocationFix | null) => {
      if (settled) {
        return;
      }
      settled = true;
      setInitialCenter(
        resolveInitialMapCenterLngLat({
          destination,
          trustedFix: fix,
          seedCenter,
        }),
      );
    };

    const release = acquireSharedForegroundLocation("find-parking-boot");
    const unsub = subscribeSharedForegroundLocation((snap) => {
      if (snap.trustedFix) {
        finish(snap.trustedFix);
        return;
      }
      if (snap.status === "error") {
        finish(null);
      }
    });

    const timeoutId = window.setTimeout(() => {
      finish(peekTrustedSharedForegroundFix());
    }, INITIAL_MAP_LOCATION_WAIT_MS);

    return () => {
      settled = true;
      window.clearTimeout(timeoutId);
      unsub();
      release();
    };
  }, [destination, initialCenter, seedCenter]);

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

    // Unexpected out-of-area destination: keep fallback map view, no loop.
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
      data-map-bottom={stageBottomStack}
      data-map-mode={mode}
      data-testid="parking-map-stage"
    >
      {!isPicker &&
      mapVisuallyReady &&
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

      {!isPicker &&
      mapVisuallyReady &&
      locationFailure &&
      !locationNoticeHidden ? (
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

      {!isPicker &&
      mapVisuallyReady &&
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
              Browsing the map area.
            </p>
          </div>
        </div>
      ) : null}

      <div className="absolute inset-0 z-0 h-full w-full">
        {awaitingInitialCamera || !initialCenter ? (
          <div
            className="absolute inset-0"
            data-testid="map-initial-location-loading"
          >
            <MapLoadingState />
          </div>
        ) : (
          <BaseMap
            key={mapInstanceKey}
            styleUrl={mapTilerStyleUrl!}
            center={initialCenter}
            zoom={initialZoom}
            className={PARKING_MAP_BASEMAP_CLASS}
            interactionDebugLabel={isPicker ? "share-spot" : "find-parking"}
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
                    if (isPicker) {
                      userGestureActiveRef.current = true;
                      pinRef.current?.classList.add("is-lifting");
                      pickerCallbacksRef.current.onPickerInteractionStart?.();
                    }
                  }
                });
                map.on("zoomstart", (event) => {
                  if (isUserMapGesture(event)) {
                    markUserMovedMap();
                    if (isPicker) {
                      userGestureActiveRef.current = true;
                      pickerCallbacksRef.current.onPickerInteractionStart?.();
                    }
                  }
                });

                map.on("moveend", () => {
                  const center = map.getCenter();
                  writeSessionMapCamera(isPicker ? "publisher" : "seeker", {
                    center: [center.lng, center.lat],
                    zoom: map.getZoom(),
                  });

                  if (!isPicker) {
                    return;
                  }

                  pinRef.current?.classList.remove("is-lifting");
                  if (pickerDisabledRef.current) {
                    userGestureActiveRef.current = false;
                    return;
                  }

                  const wasUserGesture = userGestureActiveRef.current;
                  userGestureActiveRef.current = false;
                  const prev = lastPickerCommitRef.current;
                  if (
                    prev &&
                    coordsNearlyEqual(center.lat, center.lng, prev.lat, prev.lng)
                  ) {
                    if (wasUserGesture) {
                      pickerCallbacksRef.current.onPickerInteractionSettled?.();
                    }
                    return;
                  }

                  lastPickerCommitRef.current = {
                    lat: center.lat,
                    lng: center.lng,
                  };
                  if (wasUserGesture) {
                    pickerCallbacksRef.current.onPickerUserMovedMap?.();
                    setShowPickerSelectedHint(true);
                  }
                  pickerCallbacksRef.current.onPickerLocationChange?.(
                    center.lat,
                    center.lng,
                  );
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
              const pendingPickerRecenter =
                pendingPickerExternalRecenterRef.current;
              if (pendingPickerRecenter) {
                applyPickerExternalRecenter(pendingPickerRecenter);
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
        )}
      </div>

      {isPicker ? (
        <div
          className={[
            "pointer-events-none absolute inset-0 z-[2] flex items-center justify-center overflow-visible map-pin-fade",
            mapVisuallyReady ? "is-ready" : "",
          ].join(" ")}
          aria-hidden="true"
          data-testid="leaver-center-pin-overlay"
        >
          <div ref={pinRef} className="leaver-center-pin">
            <svg
              width="40"
              height="48"
              viewBox="0 0 40 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M20 46c0 0 14-14.2 14-26a14 14 0 1 0-28 0c0 11.8 14 26 14 26Z"
                fill="#55bff3"
                stroke="#ffffff"
                strokeWidth="2.5"
              />
              <circle cx="20" cy="18" r="8" fill="#ffffff" />
              <path
                d="M16.1 12.6h5.1c2.5 0 4.2 1.55 4.2 3.85 0 2.2-1.7 3.75-4.2 3.75h-2.55V23.4h-2.55V12.6Zm2.55 2.05v3.4h2.35c1.15 0 1.85-.7 1.85-1.7 0-1-.7-1.7-1.85-1.7h-2.35Z"
                fill="#2fa9e6"
              />
            </svg>
          </div>
        </div>
      ) : null}

      {isPicker && showPickerSelectedHint && mapVisuallyReady ? (
        <p
          className={[
            "pointer-events-none absolute left-3 z-[3] rounded-full border border-border bg-surface/95 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm motion-fade-in",
            isFullscreenPicker
              ? "bottom-[calc(var(--map-compose-sheet-clearance)+0.75rem)]"
              : "bottom-3",
          ].join(" ")}
          role="status"
        >
          Location selected
        </p>
      ) : null}

      {mapVisuallyReady ? (
        <CurrentLocationControl
          variant={isFullscreenPicker ? "floating" : isPicker ? "embedded" : "floating"}
          ariaLabel={
            isPicker ? "Use my current location" : "Center on my location"
          }
          data-testid={
            isPicker ? "picker-current-location-control" : "map-recenter-control"
          }
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
