"use client";

import { Map as MapLibreMap } from "maplibre-gl";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef } from "react";

import { configureMapLibreRtlPlugin } from "@/lib/map/configure-maplibre-rtl";
import { configureMapLibreWorker } from "@/lib/map/configure-maplibre-worker";
import {
  createMapTilerTransformRequest,
  sanitizeMapTilerUrl,
} from "@/lib/map/maptiler-transform-request";
import {
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_SUPPORTED_MAX_BOUNDS,
  getMapTilerApiKey,
} from "@/lib/map/seekerMapConfig";

import "maplibre-gl/dist/maplibre-gl.css";

type BaseMapProps = {
  styleUrl: string;
  center: [number, number]; // [lng, lat]
  zoom: number;
  className?: string;
  onMapReady: (map: MapLibreMap) => void;
  onMapUnavailable?: () => void;
};

function logMapError(error: unknown) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown map error";

  // Missing-image noise is handled (deduped) by the styleimagemissing listener.
  if (/could not be loaded|Image "/i.test(message)) {
    return;
  }

  // Never log style URLs or API keys.
  console.error("[map] MapLibre error:", message);
}

const loggedMissingStyleImageIds = new Set<string>();

function logMissingStyleImageOnce(id: unknown) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  if (typeof id !== "string") {
    return;
  }

  // Ignore blank/whitespace IDs in diagnostics only — do not fabricate images.
  if (id.trim() === "") {
    return;
  }

  if (loggedMissingStyleImageIds.has(id)) {
    return;
  }
  loggedMissingStyleImageIds.add(id);
  console.warn("[map] Missing style image id:", JSON.stringify(id));
}

function logSpriteDiagnostics(map: MapLibreMap) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const style = map.getStyle();
  const sprite = style?.sprite;
  let shape: string;
  if (sprite == null) {
    shape = "absent";
  } else if (typeof sprite === "string") {
    shape = "string";
  } else if (Array.isArray(sprite)) {
    shape = `array(${sprite.length})`;
  } else {
    shape = typeof sprite;
  }

  let entries: Array<{
    id: string;
    host: string;
    path: string;
    hasKeyParam: boolean;
  }> = [];

  try {
    if (typeof map.getSprite === "function") {
      entries = map.getSprite().map((entry) => ({
        id: entry.id,
        ...sanitizeMapTilerUrl(entry.url),
      }));
    }
  } catch {
    entries = [];
  }

  console.info("[map] Sprite config after load", {
    shape,
    entryCount: entries.length,
    entries,
    // Confirm we did not run language/style rewriting.
    languageRewriteApplied: false,
  });
}

function logContainerMetrics(
  label: string,
  el: HTMLElement | null,
  mapReady: boolean,
) {
  if (process.env.NODE_ENV !== "development" || !el) {
    return;
  }
  const rect = el.getBoundingClientRect();
  console.info("[map]", label, {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    mapReady,
  });
}

export function BaseMap({
  styleUrl,
  center,
  zoom,
  className = "",
  onMapReady,
  onMapUnavailable,
}: BaseMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onMapReadyRef = useRef(onMapReady);
  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  // Dimensions come from className / parent. Avoid inline height:100% which
  // overrides Tailwind height utilities and collapses when the parent height
  // is content-based.
  const style = useMemo((): CSSProperties => ({ width: "100%" }), []);

  useEffect(() => {
    if (mapRef.current) {
      return;
    }
    if (!containerRef.current) {
      return;
    }

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let didLogInitialResize = false;

    try {
      configureMapLibreWorker();
      configureMapLibreRtlPlugin();

      const container = containerRef.current;
      logContainerMetrics("BaseMap mount", container, false);

      const transformRequest = createMapTilerTransformRequest(
        getMapTilerApiKey(),
      );

      const map = new MapLibreMap({
        container,
        style: styleUrl,
        center,
        zoom,
        minZoom: MAP_MIN_ZOOM,
        maxZoom: MAP_MAX_ZOOM,
        maxBounds: MAP_SUPPORTED_MAX_BOUNDS,
        renderWorldCopies: false,
        transformRequest,
        attributionControl: {
          compact: true,
        },
        dragRotate: false,
        touchPitch: false,
        pitchWithRotate: false,
        maxPitch: 0,
      });

      mapRef.current = map;

      map.on("error", (event) => {
        logMapError(event.error ?? event);
      });

      // Single development diagnostic for missing basemap/runtime images.
      map.on("styleimagemissing", (event) => {
        logMissingStyleImageOnce(event?.id);
      });

      const requestResize = () => {
        if (cancelled || !mapRef.current) {
          return;
        }
        mapRef.current.resize();
      };

      map.once("load", () => {
        if (cancelled || !mapRef.current) {
          return;
        }

        requestResize();
        logContainerMetrics("BaseMap load", containerRef.current, true);
        logSpriteDiagnostics(mapRef.current);
        onMapReadyRef.current(mapRef.current);
      });

      if (typeof ResizeObserver === "function") {
        resizeObserver = new ResizeObserver(() => {
          requestResize();
          if (!didLogInitialResize) {
            didLogInitialResize = true;
            logContainerMetrics("BaseMap resize", containerRef.current, true);
          }
        });
        resizeObserver.observe(container);
      }

      const rafId = window.requestAnimationFrame(() => {
        requestResize();
      });

      return () => {
        cancelled = true;
        window.cancelAnimationFrame(rafId);
        resizeObserver?.disconnect();
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    } catch (error) {
      logMapError(error);
      if (!cancelled) {
        onMapUnavailable?.();
      }
      return () => {
        cancelled = true;
        resizeObserver?.disconnect();
      };
    }
  }, [center, styleUrl, zoom, onMapUnavailable]);

  return <div ref={containerRef} className={className} style={style} />;
}
