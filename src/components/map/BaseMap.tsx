"use client";

import { Map as MapLibreMap } from "maplibre-gl";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  MAP_READY_FADE_MS,
  MapLoadingState,
} from "@/components/map/MapLoadingState";
import { configureMapLibreRtlPlugin } from "@/lib/map/configure-maplibre-rtl";
import { configureMapLibreWorker } from "@/lib/map/configure-maplibre-worker";
import {
  createMapTilerTransformRequest,
  sanitizeMapTilerUrl,
} from "@/lib/map/maptiler-transform-request";
import {
  isIgnorableMapError,
  logMapLibreError,
} from "@/lib/map/is-ignorable-map-error";
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
  /** Fires when the map is visually ready (load + idle). */
  onVisuallyReady?: () => void;
  onMapUnavailable?: () => void;
};

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
  onVisuallyReady,
  onMapUnavailable,
}: BaseMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onMapReadyRef = useRef(onMapReady);
  const onVisuallyReadyRef = useRef(onVisuallyReady);
  const onMapUnavailableRef = useRef(onMapUnavailable);
  const [visuallyReady, setVisuallyReady] = useState(false);
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    onVisuallyReadyRef.current = onVisuallyReady;
  }, [onVisuallyReady]);

  useEffect(() => {
    onMapUnavailableRef.current = onMapUnavailable;
  }, [onMapUnavailable]);

  useEffect(() => {
    if (!visuallyReady) {
      return;
    }
    const id = window.setTimeout(() => {
      setShowLoader(false);
    }, MAP_READY_FADE_MS);
    return () => window.clearTimeout(id);
  }, [visuallyReady]);

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
    let styleLoaded = false;
    let visualReadyMarked = false;

    const markVisuallyReady = () => {
      if (cancelled || visualReadyMarked) {
        return;
      }
      visualReadyMarked = true;
      setVisuallyReady(true);
      onVisuallyReadyRef.current?.();
    };

    const signalUnavailable = () => {
      if (cancelled || visualReadyMarked) {
        return;
      }
      onMapUnavailableRef.current?.();
    };

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
        logMapLibreError(event.error ?? event);
        // Before style load, escalate genuine init/style failures.
        // After load, ignore tile noise so the loader is not stuck forever.
        if (styleLoaded || isIgnorableMapError(event.error ?? event)) {
          return;
        }
        signalUnavailable();
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

      // Style + first render: hand map to parents for layers.
      // Visual readiness waits for the subsequent idle so tiles/paint settle.
      map.once("load", () => {
        if (cancelled || !mapRef.current) {
          return;
        }

        styleLoaded = true;
        requestResize();
        logContainerMetrics("BaseMap load", containerRef.current, true);
        logSpriteDiagnostics(mapRef.current);
        onMapReadyRef.current(mapRef.current);

        map.once("idle", () => {
          markVisuallyReady();
        });
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
      logMapLibreError(error);
      if (!cancelled) {
        onMapUnavailableRef.current?.();
      }
      return () => {
        cancelled = true;
        resizeObserver?.disconnect();
      };
    }
  }, [center, styleUrl, zoom]);

  return (
    <div className={["relative h-full w-full", className].join(" ")} style={style}>
      <div
        ref={containerRef}
        className={[
          "absolute inset-0 h-full w-full map-canvas-fade",
          visuallyReady ? "is-ready" : "",
        ].join(" ")}
      />
      {showLoader ? (
        <div
          className={[
            "absolute inset-0 z-[1] map-loader-fade",
            visuallyReady ? "is-hidden" : "",
          ].join(" ")}
        >
          <MapLoadingState />
        </div>
      ) : null}
    </div>
  );
}
