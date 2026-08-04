"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
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
  disabled?: boolean;
  /** Optional detected user location for the compact Recenter control. */
  userLatitude?: number | null;
  userLongitude?: number | null;
};

export { LEAVER_MAP_SHELL_HEIGHT_CLASS } from "@/lib/map/leaverMapShell";

const COORD_EPSILON = 1e-7;

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

function setMapInteractionEnabled(map: MapLibreMap, enabled: boolean) {
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
}

/**
 * Leaver parking-location picker (MapLibre).
 * Fixed center pin; map pans underneath; coords update from map.getCenter().
 */
export function SpotLocationPickerMapLibre({
  latitude,
  longitude,
  onLocationChange,
  disabled = false,
  userLatitude = null,
  userLongitude = null,
}: SpotLocationPickerProps) {
  const styleUrl = useMemo(() => assertMapTilerStyleUrlOrNull(), []);
  const mapRef = useRef<MapLibreMap | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const programmaticMoveRef = useRef(false);
  const [pinLifting, setPinLifting] = useState(false);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [mapVisuallyReady, setMapVisuallyReady] = useState(false);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  const canRecenter =
    typeof userLatitude === "number" &&
    Number.isFinite(userLatitude) &&
    typeof userLongitude === "number" &&
    Number.isFinite(userLongitude);

  const initialCenter: [number, number] = [longitude, latitude];

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    setMapInteractionEnabled(map, !disabled);
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
          setMapInteractionEnabled(map, !disabled);

          if (process.env.NODE_ENV === "development" && shellRef.current) {
            const rect = shellRef.current.getBoundingClientRect();
            console.info("[map] Leaver picker ready", {
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              mapCreated: true,
              mapLoadFired: true,
            });
          }

          map.on("movestart", () => {
            if (programmaticMoveRef.current || disabled) {
              return;
            }
            setPinLifting(true);
          });

          map.on("moveend", () => {
            setPinLifting(false);
            if (programmaticMoveRef.current || disabled) {
              return;
            }
            const center = map.getCenter();
            onLocationChangeRef.current(center.lat, center.lng);
          });
        }}
      />

      {/* Fixed center parking pin — above canvas; hidden until map is visually ready. */}
      <div
        className={[
          "pointer-events-none absolute inset-0 z-[2] flex items-center justify-center overflow-visible map-canvas-fade",
          mapVisuallyReady ? "is-ready" : "",
        ].join(" ")}
        aria-hidden="true"
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

      {canRecenter && mapVisuallyReady ? (
        <div className="absolute right-2 top-2 z-[3]">
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
