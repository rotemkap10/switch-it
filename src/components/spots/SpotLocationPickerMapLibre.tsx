"use client";

import { NavigationControl, type Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";

import { BaseMap } from "@/components/map/BaseMap";
import {
  CurrentLocationControl,
  CurrentLocationUnavailableNotice,
} from "@/components/map/CurrentLocationControl";
import { MapUnavailable } from "@/components/map/MapUnavailable";
import { centerMapOnLocation } from "@/lib/map/center-on-location";
import type { DeviceLocationFix } from "@/lib/map/request-current-device-location";
import { useMapRecenter } from "@/lib/map/use-map-recenter";
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion";
import { isMapCameraBusy } from "@/lib/map/maplibre-interaction";
import {
  MAP_SELECTED_SPOT_ZOOM,
  assertMapTilerStyleUrlOrNull,
} from "@/lib/map/seekerMapConfig";
import {
  LEAVER_MAP_SHELL_HEIGHT_CLASS,
  shouldShowLeaverMapZoomControls,
} from "@/lib/map/leaverMapShell";
import {
  clearSessionMapCamera,
  writeSessionMapCamera,
} from "@/lib/map/session-camera";
import {
  PICKER_USER_LOCATION_IDS,
  syncUserLocationDot,
} from "@/lib/map/user-location-dot";

export type SpotLocationPickerProps = {
  latitude: number;
  longitude: number;
  onLocationChange: (latitude: number, longitude: number) => void;
  /** Fired when the user begins panning/zooming (before moveend). */
  onMapInteractionStart?: () => void;
  /** Fired when a user gesture ended without changing the pin coordinates. */
  onMapInteractionSettled?: () => void;
  /** Fired when the user intentionally moved the map (not GPS / recenter). */
  onUserMovedMap?: () => void;
  /** Fired immediately when the user taps "Current location" (before GPS resolves). */
  onCurrentLocationRequested?: () => void;
  disabled?: boolean;
  /** Optional detected user location for the live current-location puck. */
  userLatitude?: number | null;
  userLongitude?: number | null;
  userAccuracy?: number | null;
  /** Called when recenter obtains a fresh device fix (updates parent cache). */
  onCurrentLocationResolved?: (fix: DeviceLocationFix) => void;
};

export { LEAVER_MAP_SHELL_HEIGHT_CLASS } from "@/lib/map/leaverMapShell";

const COORD_EPSILON = 1e-7;
const LOCATION_SELECTED_MS = 1600;

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

/**
 * Leaver parking-location picker (MapLibre).
 * Fixed center pin; map pans underneath; coords commit from map.getCenter()
 * only after moveend. Gesture handlers come solely from BaseMap — this picker
 * must not disable/re-enable dragPan.
 */
export function SpotLocationPickerMapLibre({
  latitude,
  longitude,
  onLocationChange,
  onMapInteractionStart,
  onMapInteractionSettled,
  onUserMovedMap,
  disabled = false,
  userLatitude = null,
  userLongitude = null,
  userAccuracy = null,
  onCurrentLocationRequested,
  onCurrentLocationResolved,
}: SpotLocationPickerProps) {
  const styleUrl = useMemo(() => assertMapTilerStyleUrlOrNull(), []);
  const mapRef = useRef<MapLibreMap | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const onMapInteractionStartRef = useRef(onMapInteractionStart);
  const onMapInteractionSettledRef = useRef(onMapInteractionSettled);
  const onUserMovedMapRef = useRef(onUserMovedMap);
  const latitudeRef = useRef(latitude);
  const longitudeRef = useRef(longitude);
  const programmaticMoveRef = useRef(false);
  const pendingCameraSyncRef = useRef(false);
  /** True from user movestart until moveend (includes pan inertia). */
  const userGestureActiveRef = useRef(false);
  const handlersBoundRef = useRef(false);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [mapInstanceKey, setMapInstanceKey] = useState(0);
  const [mapVisuallyReady, setMapVisuallyReady] = useState(false);
  const [pickerLayersReady, setPickerLayersReady] = useState(false);
  const [showSelectedHint, setShowSelectedHint] = useState(false);
  const [recenterNoticeVisible, setRecenterNoticeVisible] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Stable initial camera for BaseMap — never recreate from moveend updates.
  // Always start at the caller-provided fallback; GPS/recenter move the camera.
  const [initialCenter] = useState<[number, number]>(() => [
    longitude,
    latitude,
  ]);
  const [initialZoom] = useState(() => MAP_SELECTED_SPOT_ZOOM);

  useEffect(() => {
    return () => {
      clearSessionMapCamera("publisher");
    };
  }, []);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    onMapInteractionStartRef.current = onMapInteractionStart;
  }, [onMapInteractionStart]);

  useEffect(() => {
    onMapInteractionSettledRef.current = onMapInteractionSettled;
  }, [onMapInteractionSettled]);

  useEffect(() => {
    onUserMovedMapRef.current = onUserMovedMap;
  }, [onUserMovedMap]);

  useEffect(() => {
    latitudeRef.current = latitude;
    longitudeRef.current = longitude;
  }, [latitude, longitude]);

  const { recenter: recenterOnDeviceLocation, pending: recenterPending } =
    useMapRecenter({
      onFix: (fix) => {
        setRecenterNoticeVisible(false);
        onCurrentLocationResolved?.(fix);

        const map = mapRef.current;
        if (!map || disabled) {
          return;
        }

        // Center-pin model: move the map; selected coords come from getCenter().
        programmaticMoveRef.current = true;
        centerMapOnLocation(map, fix.longitude, fix.latitude, {
          minStreetZoom: true,
          reducedMotion: prefersReducedMotion,
        });
        map.once("moveend", () => {
          programmaticMoveRef.current = false;
          const center = map.getCenter();
          onLocationChangeRef.current(center.lat, center.lng);
          setShowSelectedHint(true);
        });
      },
      onError: () => {
        setRecenterNoticeVisible(true);
      },
    });

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
    if (!pickerLayersReady) {
      return;
    }
    if (
      userLatitude == null ||
      userLongitude == null ||
      !Number.isFinite(userLatitude) ||
      !Number.isFinite(userLongitude)
    ) {
      syncUserLocationDot(mapRef.current, PICKER_USER_LOCATION_IDS, null);
      return;
    }
    syncUserLocationDot(mapRef.current, PICKER_USER_LOCATION_IDS, {
      latitude: userLatitude,
      longitude: userLongitude,
      accuracy: userAccuracy,
    });
  }, [pickerLayersReady, userAccuracy, userLatitude, userLongitude]);

  // Sync external coordinate changes (GPS / address) into the map camera —
  // only when MapLibre is fully idle. Never fight a user pan or inertia.
  // Current Location uses centerMapOnLocation separately.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pickerLayersReady || disabled) {
      return;
    }

    if (
      programmaticMoveRef.current ||
      userGestureActiveRef.current ||
      isMapCameraBusy(map)
    ) {
      pendingCameraSyncRef.current = true;
      return;
    }

    const center = map.getCenter();
    if (coordsNearlyEqual(center.lat, center.lng, latitude, longitude)) {
      pendingCameraSyncRef.current = false;
      return;
    }

    let cancelled = false;
    programmaticMoveRef.current = true;
    pendingCameraSyncRef.current = false;
    map.jumpTo({ center: [longitude, latitude] });
    const releaseProgrammaticMove = () => {
      if (cancelled) {
        return;
      }
      programmaticMoveRef.current = false;
      if (!pendingCameraSyncRef.current) {
        return;
      }
      pendingCameraSyncRef.current = false;
      const nextCenter = map.getCenter();
      if (
        coordsNearlyEqual(
          nextCenter.lat,
          nextCenter.lng,
          latitudeRef.current,
          longitudeRef.current,
        )
      ) {
        return;
      }
      if (userGestureActiveRef.current || isMapCameraBusy(map)) {
        pendingCameraSyncRef.current = true;
        return;
      }
      programmaticMoveRef.current = true;
      map.jumpTo({
        center: [longitudeRef.current, latitudeRef.current],
      });
      map.once("moveend", () => {
        programmaticMoveRef.current = false;
      });
      window.setTimeout(() => {
        programmaticMoveRef.current = false;
      }, 100);
    };
    map.once("moveend", releaseProgrammaticMove);
    const timeoutId = window.setTimeout(releaseProgrammaticMove, 100);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [latitude, longitude, disabled, pickerLayersReady]);

  useEffect(() => {
    if (!showSelectedHint) {
      return;
    }
    const id = window.setTimeout(() => {
      setShowSelectedHint(false);
    }, LOCATION_SELECTED_MS);
    return () => window.clearTimeout(id);
  }, [showSelectedHint]);

  if (styleUrl === null) {
    return (
      <div
        className={`flex items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-border p-4 ${LEAVER_MAP_SHELL_HEIGHT_CLASS}`}
        aria-label="Map to adjust your parking spot location"
      >
        <MapUnavailable reason="configuration" />
      </div>
    );
  }

  if (mapUnavailable) {
    return (
      <div
        className={`flex items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-border p-4 ${LEAVER_MAP_SHELL_HEIGHT_CLASS}`}
        aria-label="Map to adjust your parking spot location"
      >
        <MapUnavailable
          reason="temporary"
          onRetry={() => {
            handlersBoundRef.current = false;
            mapRef.current = null;
            setMapVisuallyReady(false);
            setPickerLayersReady(false);
            setMapUnavailable(false);
            setMapInstanceKey((key) => key + 1);
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={shellRef}
      className={[
        "relative w-full overflow-hidden",
        "rounded-[var(--radius-card)] border border-border",
        LEAVER_MAP_SHELL_HEIGHT_CLASS,
        // Lock gestures without touching BaseMap's dragPan handlers.
        disabled ? "pointer-events-none" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Map to adjust your parking spot location"
      data-testid="leaver-map-picker"
    >
      {/* Explicit shell height; BaseMap fills it so the canvas is never 0×0. */}
      <BaseMap
        key={mapInstanceKey}
        styleUrl={styleUrl}
        center={initialCenter}
        zoom={initialZoom}
        className="absolute inset-0 z-0 h-full w-full"
        interactionDebugLabel="share-spot"
        onMapUnavailable={() => setMapUnavailable(true)}
        onVisuallyReady={() => setMapVisuallyReady(true)}
        onMapReady={(map) => {
          mapRef.current = map;
          // Do NOT call dragPan.enable/disable here — BaseMap owns gestures.

          if (
            shouldShowLeaverMapZoomControls() &&
            !map.getContainer().querySelector(".maplibregl-ctrl-zoom-in")
          ) {
            map.addControl(
              new NavigationControl({
                showCompass: false,
                visualizePitch: false,
                showZoom: true,
              }),
              "bottom-right",
            );
          }

          // GPS may have already updated parent coords while the map was still
          // mounting. BaseMap freezes initialCenter, so apply a pending jump now.
          const readyCenter = map.getCenter();
          if (
            !disabled &&
            !coordsNearlyEqual(
              readyCenter.lat,
              readyCenter.lng,
              latitudeRef.current,
              longitudeRef.current,
            )
          ) {
            programmaticMoveRef.current = true;
            map.jumpTo({
              center: [longitudeRef.current, latitudeRef.current],
            });
            map.once("moveend", () => {
              programmaticMoveRef.current = false;
            });
            window.setTimeout(() => {
              programmaticMoveRef.current = false;
            }, 100);
          }

          setPickerLayersReady(true);

          if (handlersBoundRef.current) {
            return;
          }
          handlersBoundRef.current = true;

          map.on("movestart", (e) => {
            const isUserGesture = Boolean(
              (e as unknown as { originalEvent?: unknown } | undefined)
                ?.originalEvent,
            );
            if (disabled || !isUserGesture) {
              return;
            }
            userGestureActiveRef.current = true;
            pinRef.current?.classList.add("is-lifting");
            onMapInteractionStartRef.current?.();
          });

          map.on("moveend", () => {
            userGestureActiveRef.current = false;
            pinRef.current?.classList.remove("is-lifting");
            if (programmaticMoveRef.current || disabled) {
              return;
            }
            const center = map.getCenter();
            const prevLat = latitudeRef.current;
            const prevLng = longitudeRef.current;
            if (coordsNearlyEqual(center.lat, center.lng, prevLat, prevLng)) {
              onMapInteractionSettledRef.current?.();
              return;
            }
            latitudeRef.current = center.lat;
            longitudeRef.current = center.lng;
            pendingCameraSyncRef.current = false;
            writeSessionMapCamera("publisher", {
              center: [center.lng, center.lat],
              zoom: map.getZoom(),
            });
            onUserMovedMapRef.current?.();
            onLocationChangeRef.current(center.lat, center.lng);
            setShowSelectedHint(true);
          });
        }}
      />

      {/* Fixed center pin — decorative only; must never capture pointers. */}
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

      {showSelectedHint && mapVisuallyReady ? (
        <p
          className="pointer-events-none absolute bottom-3 left-3 z-[3] rounded-full border border-border bg-surface/95 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm motion-fade-in"
          role="status"
        >
          Location selected
        </p>
      ) : null}

      {mapVisuallyReady ? (
        <CurrentLocationControl
          variant="embedded"
          ariaLabel="Use my current location"
          data-testid="picker-current-location-control"
          pending={recenterPending}
          disabled={disabled}
          onClick={() => {
            onCurrentLocationRequested?.();
            void recenterOnDeviceLocation();
          }}
        />
      ) : null}

      {mapVisuallyReady && recenterNoticeVisible ? (
        <div className="pointer-events-none absolute right-2 top-2 z-[3]">
          <CurrentLocationUnavailableNotice />
        </div>
      ) : null}
    </div>
  );
}

/** Adapter export — loader / rollback switch by import path only. */
export function SpotLocationPicker(props: SpotLocationPickerProps) {
  return <SpotLocationPickerMapLibre {...props} />;
}
