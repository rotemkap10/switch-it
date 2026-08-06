"use client";

import { NavigationControl, type Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";

import { BaseMap } from "@/components/map/BaseMap";
import { MapUnavailable } from "@/components/map/MapUnavailable";
import { Button } from "@/components/ui/Button";
import {
  MAP_SELECTED_SPOT_ZOOM,
  assertMapTilerStyleUrlOrNull,
} from "@/lib/map/seekerMapConfig";
import { LEAVER_MAP_SHELL_HEIGHT_CLASS } from "@/lib/map/leaverMapShell";

export type SpotLocationPickerProps = {
  latitude: number;
  longitude: number;
  onLocationChange: (latitude: number, longitude: number) => void;
  /** Fired when the user begins panning/zooming (before moveend). */
  onMapInteractionStart?: () => void;
  disabled?: boolean;
  /** Optional detected user location for the compact Recenter control. */
  userLatitude?: number | null;
  userLongitude?: number | null;
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
 * Enable pan/zoom for the center-pin picker.
 * Rotation stays disabled so mobile gestures stay simple.
 */
export function setPickerMapInteractionEnabled(
  map: MapLibreMap,
  enabled: boolean,
) {
  const handlers = [
    map.dragPan,
    map.scrollZoom,
    map.boxZoom,
    map.doubleClickZoom,
    map.touchZoomRotate,
    map.keyboard,
  ] as const;

  for (const handler of handlers) {
    if (enabled) {
      handler.enable();
    } else {
      handler.disable();
    }
  }

  // Keep pinch zoom; suppress two-finger rotate.
  if (enabled && typeof map.touchZoomRotate.disableRotation === "function") {
    map.touchZoomRotate.disableRotation();
  }
}

/**
 * Leaver parking-location picker (MapLibre).
 * Fixed center pin; map pans underneath; coords update from map.getCenter().
 */
export function SpotLocationPickerMapLibre({
  latitude,
  longitude,
  onLocationChange,
  onMapInteractionStart,
  disabled = false,
  userLatitude = null,
  userLongitude = null,
}: SpotLocationPickerProps) {
  const styleUrl = useMemo(() => assertMapTilerStyleUrlOrNull(), []);
  const mapRef = useRef<MapLibreMap | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const onMapInteractionStartRef = useRef(onMapInteractionStart);
  const programmaticMoveRef = useRef(false);
  const handlersBoundRef = useRef(false);
  const [pinLifting, setPinLifting] = useState(false);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [mapVisuallyReady, setMapVisuallyReady] = useState(false);
  const [showSelectedHint, setShowSelectedHint] = useState(false);

  // Stable initial camera for BaseMap — never recreate from moveend updates.
  const [initialCenter] = useState<[number, number]>(() => [
    longitude,
    latitude,
  ]);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    onMapInteractionStartRef.current = onMapInteractionStart;
  }, [onMapInteractionStart]);

  const canRecenter =
    typeof userLatitude === "number" &&
    Number.isFinite(userLatitude) &&
    typeof userLongitude === "number" &&
    Number.isFinite(userLongitude);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    setPickerMapInteractionEnabled(map, !disabled);
  }, [disabled]);

  // Sync external coordinate changes (e.g. manual entry) into the map view.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || disabled) {
      return;
    }

    const center = map.getCenter();
    if (coordsNearlyEqual(center.lat, center.lng, latitude, longitude)) {
      return;
    }

    programmaticMoveRef.current = true;
    map.jumpTo({ center: [longitude, latitude] });
    map.resize();
    programmaticMoveRef.current = false;
  }, [latitude, longitude, disabled]);

  useEffect(() => {
    if (!showSelectedHint) {
      return;
    }
    const id = window.setTimeout(() => {
      setShowSelectedHint(false);
    }, LOCATION_SELECTED_MS);
    return () => window.clearTimeout(id);
  }, [showSelectedHint]);

  if (styleUrl === null || mapUnavailable) {
    return (
      <div
        className={`motion-fade-slide-up flex items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-border p-4 ${LEAVER_MAP_SHELL_HEIGHT_CLASS}`}
        aria-label="Map to adjust your parking spot location"
      >
        <MapUnavailable />
      </div>
    );
  }

  return (
    <div
      ref={shellRef}
      className={[
        "motion-fade-slide-up relative w-full overflow-hidden",
        "rounded-[var(--radius-card)] border border-border",
        LEAVER_MAP_SHELL_HEIGHT_CLASS,
      ].join(" ")}
      aria-label="Map to adjust your parking spot location"
      data-testid="leaver-map-picker"
    >
      {/* Explicit shell height; BaseMap fills it so the canvas is never 0×0. */}
      <BaseMap
        styleUrl={styleUrl}
        center={initialCenter}
        zoom={MAP_SELECTED_SPOT_ZOOM}
        className="absolute inset-0 z-0 h-full w-full"
        onMapUnavailable={() => setMapUnavailable(true)}
        onVisuallyReady={() => setMapVisuallyReady(true)}
        onMapReady={(map) => {
          mapRef.current = map;
          map.resize();
          setPickerMapInteractionEnabled(map, !disabled);

          if (!map.getContainer().querySelector(".maplibregl-ctrl-zoom-in")) {
            map.addControl(
              new NavigationControl({
                showCompass: false,
                visualizePitch: false,
              }),
              "bottom-right",
            );
          }

          if (handlersBoundRef.current) {
            return;
          }
          handlersBoundRef.current = true;

          map.on("movestart", () => {
            if (programmaticMoveRef.current || disabled) {
              return;
            }
            setPinLifting(true);
            onMapInteractionStartRef.current?.();
          });

          map.on("moveend", () => {
            setPinLifting(false);
            if (programmaticMoveRef.current || disabled) {
              return;
            }
            const center = map.getCenter();
            // Final center only — never on every move frame.
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
        <div
          className={["leaver-center-pin", pinLifting ? "is-lifting" : ""].join(
            " ",
          )}
        >
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
            <circle cx="20" cy="18" r="7.5" fill="#ffffff" />
            <path
              d="M17.2 13.5h3.6c1.85 0 3 1 3 2.55 0 1.7-1.2 2.7-3.2 2.7H19.4v4.75h-2.2V13.5Z"
              fill="#55bff3"
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

      {canRecenter && mapVisuallyReady ? (
        <div className="pointer-events-auto absolute right-2 top-2 z-[3]">
          <Button
            type="button"
            variant="secondary"
            className="px-2.5 py-1.5 text-xs shadow-sm"
            disabled={disabled}
            onClick={() => {
              const map = mapRef.current;
              if (
                !map ||
                typeof userLatitude !== "number" ||
                typeof userLongitude !== "number"
              ) {
                return;
              }
              programmaticMoveRef.current = true;
              map.easeTo({
                center: [userLongitude, userLatitude],
                zoom: Math.max(map.getZoom(), MAP_SELECTED_SPOT_ZOOM),
                duration: 450,
                essential: true,
              });
              map.once("moveend", () => {
                programmaticMoveRef.current = false;
                const center = map.getCenter();
                onLocationChangeRef.current(center.lat, center.lng);
                setShowSelectedHint(true);
              });
            }}
            aria-label="Recenter on my location"
          >
            Recenter
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Adapter export — loader / rollback switch by import path only. */
export function SpotLocationPicker(props: SpotLocationPickerProps) {
  return <SpotLocationPickerMapLibre {...props} />;
}
