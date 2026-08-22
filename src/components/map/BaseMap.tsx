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
  shouldEscalateMapUnavailable,
} from "@/lib/map/is-ignorable-map-error";
import { mapPerfMark, mapPerfMeasure, PERF_MARKS } from "@/lib/map/map-perf";
import {
  MAP_ATTRIBUTION_CONTROL_OPTIONS,
  keepMapLibreAttributionInitiallyCollapsed,
} from "@/lib/map/maplibre-attribution";
import {
  MAP_INTERACTION_OPTIONS,
  applyMapDragPanInertia,
  isMapCameraBusy,
  isNativeAndroidCapacitor,
  resolveMapLibreReduceMotion,
  resolveMapReduceMotion,
} from "@/lib/map/maplibre-interaction";
import { logMapInteractionSnapshot } from "@/lib/map/log-map-interaction-snapshot";
import {
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_SUPPORTED_MAX_BOUNDS,
  getMapTilerApiKey,
} from "@/lib/map/seekerMapConfig";

import "maplibre-gl/dist/maplibre-gl.css";

type BaseMapProps = {
  styleUrl: string;
  /** Initial camera only — later updates must use map.jumpTo/easeTo. */
  center: [number, number]; // [lng, lat]
  /** Initial zoom only — later updates must use map APIs. */
  zoom: number;
  className?: string;
  onMapReady: (map: MapLibreMap) => void;
  /** Fires when the map is usable (style loaded + first paint). */
  onVisuallyReady?: () => void;
  onMapUnavailable?: () => void;
  /** Dev-only label for interaction snapshot logs (find-parking / share-spot). */
  interactionDebugLabel?: string;
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
  interactionDebugLabel,
}: BaseMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onMapReadyRef = useRef(onMapReady);
  const onVisuallyReadyRef = useRef(onVisuallyReady);
  const onMapUnavailableRef = useRef(onMapUnavailable);
  const interactionDebugLabelRef = useRef(interactionDebugLabel);
  // Capture construction camera once — do not recreate the map when parents
  // pass new center/zoom arrays after moveend or re-render.
  const initialViewRef = useRef({ center, zoom });
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
    interactionDebugLabelRef.current = interactionDebugLabel;
  }, [interactionDebugLabel]);

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
    let paintFrame = 0;
    let idleFallbackTimer = 0;
    let resizeWhileMovingScheduled = false;

    const markVisuallyReady = (reason: string) => {
      if (cancelled || visualReadyMarked) {
        return;
      }
      visualReadyMarked = true;
      mapPerfMark("map:usable");
      mapPerfMeasure("map:mount-to-usable", "map:mount", "map:usable");
      mapPerfMeasure(`map:usable-via-${reason}`, "map:load", "map:usable");
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
      mapPerfMark("map:mount");
      mapPerfMark(PERF_MARKS.mapCreated);
      configureMapLibreWorker();
      configureMapLibreRtlPlugin();

      const container = containerRef.current;
      logContainerMetrics("BaseMap mount", container, false);

      const transformRequest = createMapTilerTransformRequest(
        getMapTilerApiKey(),
      );

      const { center: initialCenter, zoom: initialZoom } = initialViewRef.current;

      mapPerfMark("map:constructor-start");
      const map = new MapLibreMap({
        container,
        style: styleUrl,
        center: initialCenter,
        zoom: initialZoom,
        minZoom: MAP_MIN_ZOOM,
        maxZoom: MAP_MAX_ZOOM,
        maxBounds: MAP_SUPPORTED_MAX_BOUNDS,
        renderWorldCopies: false,
        transformRequest,
        attributionControl: MAP_ATTRIBUTION_CONTROL_OPTIONS,
        // Explicit: MapLibre disables pan inertia when reduceMotion is true.
        reduceMotion: resolveMapLibreReduceMotion(),
        // Shared with Share a Spot picker — same pan inertia / touch profile.
        ...MAP_INTERACTION_OPTIONS,
      });
      mapPerfMark("map:constructor-end");
      mapPerfMeasure(
        "map:constructor",
        "map:constructor-start",
        "map:constructor-end",
      );

      // Re-assert inertia options after construct (MapLibre enable path).
      // Keeps Find Parking + Share a Spot on the same DragPanHandler profile.
      applyMapDragPanInertia(map);

      if (process.env.NODE_ENV === "development") {
        let loggedPanRelease = false;
        map.on("dragend", (event) => {
          if (loggedPanRelease || !event.originalEvent) {
            return;
          }
          loggedPanRelease = true;
          window.setTimeout(() => {
            const mapWithEasing = map as MapLibreMap & {
              isEasing?: () => boolean;
            };
            console.info("[map-interaction:pan-release]", {
              nativeAndroid: isNativeAndroidCapacitor(),
              prefersReducedMotion: resolveMapReduceMotion(),
              mapLibreReduceMotion: resolveMapLibreReduceMotion(),
              isMoving: map.isMoving(),
              isEasing:
                typeof mapWithEasing.isEasing === "function"
                  ? mapWithEasing.isEasing()
                  : null,
            });
          }, 0);
        });
      }

      mapRef.current = map;
      const stopCollapsingAttribution =
        keepMapLibreAttributionInitiallyCollapsed(map);

      map.on("error", (event) => {
        const payload = event.error ?? event;
        logMapLibreError(payload);
        // Before style load, only escalate genuine fatal style/auth/init failures.
        // Source-layer mismatches (including military_label) and tile noise must
        // not replace a loading/working map. After load, never tear down.
        if (
          styleLoaded ||
          isIgnorableMapError(payload) ||
          !shouldEscalateMapUnavailable(payload, styleLoaded)
        ) {
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
        // Never resize mid-gesture / mid-inertia — it interrupts MapLibre easing
        // (Share a Spot layout shifts used to trigger this via ResizeObserver).
        if (isMapCameraBusy(mapRef.current)) {
          if (!resizeWhileMovingScheduled) {
            resizeWhileMovingScheduled = true;
            mapRef.current.once("moveend", () => {
              resizeWhileMovingScheduled = false;
              if (!cancelled && mapRef.current) {
                mapRef.current.resize();
              }
            });
          }
          return;
        }
        mapRef.current.resize();
      };

      // Usable after style load + first paint. Do not block on full tile idle.
      map.once("load", () => {
        if (cancelled || !mapRef.current) {
          return;
        }

        styleLoaded = true;
        mapPerfMark("map:load");
        mapPerfMark(PERF_MARKS.mapLoad);
        mapPerfMeasure("map:mount-to-load", "map:mount", "map:load");
        mapPerfMeasure(
          "switch-it:map-created-to-load",
          PERF_MARKS.mapCreated,
          PERF_MARKS.mapLoad,
        );
        requestResize();
        logContainerMetrics("BaseMap load", containerRef.current, true);
        logSpriteDiagnostics(mapRef.current);
        if (interactionDebugLabelRef.current) {
          logMapInteractionSnapshot(
            interactionDebugLabelRef.current,
            mapRef.current,
          );
        }
        onMapReadyRef.current(mapRef.current);

        // Double rAF ≈ first painted frame after load handlers run.
        paintFrame = window.requestAnimationFrame(() => {
          paintFrame = window.requestAnimationFrame(() => {
            markVisuallyReady("paint");
          });
        });

        // Safety: if paint scheduling is starved, still unlock on idle.
        map.once("idle", () => {
          mapPerfMark("map:idle");
          mapPerfMark(PERF_MARKS.mapIdle);
          mapPerfMeasure(
            "switch-it:map-load-to-idle",
            PERF_MARKS.mapLoad,
            PERF_MARKS.mapIdle,
          );
          markVisuallyReady("idle");
        });

        idleFallbackTimer = window.setTimeout(() => {
          markVisuallyReady("timeout");
        }, 4000);
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

      const onVisibilityOrResume = () => {
        if (document.visibilityState === "hidden") {
          return;
        }
        // Android WebView often resumes without a container size change event;
        // force MapLibre to remeasure so the canvas is not blank/stale.
        requestResize();
      };
      document.addEventListener("visibilitychange", onVisibilityOrResume);
      window.addEventListener("pageshow", onVisibilityOrResume);
      window.addEventListener("orientationchange", onVisibilityOrResume);
      window.addEventListener("focus", onVisibilityOrResume);

      const rafId = window.requestAnimationFrame(() => {
        requestResize();
      });

      return () => {
        cancelled = true;
        window.cancelAnimationFrame(rafId);
        window.cancelAnimationFrame(paintFrame);
        window.clearTimeout(idleFallbackTimer);
        resizeObserver?.disconnect();
        document.removeEventListener("visibilitychange", onVisibilityOrResume);
        window.removeEventListener("pageshow", onVisibilityOrResume);
        window.removeEventListener("orientationchange", onVisibilityOrResume);
        window.removeEventListener("focus", onVisibilityOrResume);
        stopCollapsingAttribution();
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
    // styleUrl is the only recreate trigger. Center/zoom are initial-only.
  }, [styleUrl]);

  return (
    <div className={["relative h-full w-full", className].join(" ")} style={style}>
      <div
        ref={containerRef}
        className={[
          "absolute inset-0 h-full w-full touch-none overscroll-none map-canvas-fade",
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
