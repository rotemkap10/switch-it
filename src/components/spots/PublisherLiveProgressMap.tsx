import type { Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BaseMap } from "@/components/map/BaseMap";
import { CurrentLocationControl } from "@/components/map/CurrentLocationControl";
import { MapUnavailable } from "@/components/map/MapUnavailable";
import { logHandoffLive } from "@/lib/location/log-handoff-live";
import type { SeekerLocationPayload } from "@/lib/location/payload";
import {
  focusPublisherHandoffCamera,
  keepPublisherHandoffInView,
} from "@/lib/map/focus-publisher-handoff";
import { isMapUsable } from "@/lib/map/map-instance-guards";
import { publisherPreviewShellClass } from "@/lib/map/leaverMapShell";
import { applyMapDragPanInertia, isMapCameraBusy } from "@/lib/map/maplibre-interaction";
import {
  PUBLISHER_LIVE_DEST_SOURCE,
  applyPublisherSeekerLocation,
  ensurePublisherLiveMapSources,
  logPublisherLiveMapUpdateFailure,
  publisherLiveMapLifecycle,
} from "@/lib/map/publisher-live-map-sources";
import {
  MAP_SELECTED_SPOT_ZOOM,
  assertMapTilerStyleUrlOrNull,
} from "@/lib/map/seekerMapConfig";

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
  /** Optional diagnostics only — never auth secrets. */
  claimId?: string | null;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  claimId = null,
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
  const pendingSeekerRef = useRef<SeekerLocationPayload | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [mapInstanceKey, setMapInstanceKey] = useState(0);
  const [applyRetryTick, setApplyRetryTick] = useState(0);
  const applyRetryCountRef = useRef(0);
  const MAX_APPLY_RETRIES = 8;
  const displaySeekerRef = useRef<{ lat: number; lng: number } | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const accuracyRef = useRef(20);
  const mountedRef = useRef(true);
  const [hasKnownSeeker, setHasKnownSeeker] = useState(
    () => seekerLocation != null,
  );

  // Latch true once any seeker fix arrives; keeps legend/marker during brief null gaps.
  useEffect(() => {
    if (seekerLocation != null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sticky latch, not derived render state
      setHasKnownSeeker(true);
    }
  }, [seekerLocation]);

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

  const scheduleSeekerApplyRetry = useCallback(() => {
    if (applyRetryCountRef.current >= MAX_APPLY_RETRIES) {
      return;
    }
    applyRetryCountRef.current += 1;
    window.requestAnimationFrame(() => {
      if (mountedRef.current && pendingSeekerRef.current) {
        setApplyRetryTick((tick) => tick + 1);
      }
    });
  }, []);

  const flushPendingSeeker = useCallback(
    (map: MapLibreMap, location: SeekerLocationPayload) => {
      const result = applyPublisherSeekerLocation(
        map,
        parkingRef.current.longitude,
        parkingRef.current.latitude,
        location,
      );
      if (result.ok) {
        pendingSeekerRef.current = null;
        applyRetryCountRef.current = 0;
        return true;
      }
      pendingSeekerRef.current = location;
      return false;
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    logHandoffLive("publisher map mount");
    return () => {
      mountedRef.current = false;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      initializedRef.current = false;
      mapRef.current = null;
      pendingSeekerRef.current = null;
      logHandoffLive("publisher map unmount");
    };
  }, []);

  useEffect(() => {
    mapRef.current?.resize();
  }, [expanded]);

  const focusHandoff = useCallback(() => {
    const map = mapRef.current;
    if (!isMapUsable(map) || !initializedRef.current) {
      pendingFocusRef.current = true;
      return;
    }
    pendingFocusRef.current = false;
    userPannedRef.current = false;
    autoCameraRef.current = true;
    setAutoCamera(true);
    const seeker = seekerRef.current;
    try {
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
    } catch (error) {
      logHandoffLive(
        `publisher handoff focus failed errorMessage=${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
    if (!mapReady || !initializedRef.current) {
      if (seekerLocation) {
        pendingSeekerRef.current = seekerLocation;
      }
      return;
    }

    if (!isMapUsable(map)) {
      if (seekerLocation) {
        pendingSeekerRef.current = seekerLocation;
      }
      return;
    }

    if (!seekerLocation) {
      // Keep the last known marker during brief update gaps.
      return;
    }

    pendingSeekerRef.current = seekerLocation;
    accuracyRef.current = seekerLocation.accuracyMeters;
    const target = {
      lat: seekerLocation.latitude,
      lng: seekerLocation.longitude,
    };

    const applyPoint = (lat: number, lng: number) => {
      const liveMap = mapRef.current;
      if (!liveMap || !isMapUsable(liveMap)) {
        pendingSeekerRef.current = seekerLocation;
        return;
      }

      const result = applyPublisherSeekerLocation(
        liveMap,
        parkingRef.current.longitude,
        parkingRef.current.latitude,
        {
          ...seekerLocation,
          latitude: lat,
          longitude: lng,
        },
      );

      if (!result.ok) {
        pendingSeekerRef.current = seekerLocation;
        logPublisherLiveMapUpdateFailure(
          new Error(result.reason),
          {
            ...publisherLiveMapLifecycle(liveMap),
            claimId,
          },
        );
        scheduleSeekerApplyRetry();
        return;
      }

      pendingSeekerRef.current = null;
      displaySeekerRef.current = { lat, lng };
      applyRetryCountRef.current = 0;
    };

    const from = displaySeekerRef.current;
    logHandoffLive(
      [
        "publisher marker updated",
        `lat=${target.lat}`,
        `lng=${target.lng}`,
        `sequence=${seekerLocation.sequence}`,
        `timestamp=${seekerLocation.sentAt}`,
      ].join(" "),
    );

    try {
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
          if (!mountedRef.current || !isMapUsable(mapRef.current)) {
            animFrameRef.current = null;
            pendingSeekerRef.current = seekerLocation;
            return;
          }
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - (1 - t) * (1 - t);
          applyPoint(
            startLat + (target.lat - startLat) * eased,
            startLng + (target.lng - startLng) * eased,
          );
          if (t < 1) {
            animFrameRef.current = requestAnimationFrame(tick);
          } else {
            animFrameRef.current = null;
          }
        };
        animFrameRef.current = requestAnimationFrame(tick);
      }
    } catch (error) {
      pendingSeekerRef.current = seekerLocation;
      logPublisherLiveMapUpdateFailure(error, {
        ...publisherLiveMapLifecycle(mapRef.current),
        claimId,
      });
      return;
    }

    // Marker moves even while the publisher pans; only camera automation pauses.
    if (
      autoCameraRef.current &&
      didAutoFocusSeekerRef.current &&
      !isMapCameraBusy(map)
    ) {
      try {
        keepPublisherHandoffInView(
          map,
          {
            longitude: parkingLongitude,
            latitude: parkingLatitude,
          },
          { longitude: target.lng, latitude: target.lat },
          { reducedMotion: prefersReducedMotion() },
        );
      } catch (error) {
        logHandoffLive(
          [
            "publisher handoff keep-in-view failed",
            `errorMessage=${error instanceof Error ? error.message : String(error)}`,
          ].join(" "),
        );
      }
    }
  }, [mapReady, parkingLatitude, parkingLongitude, seekerLocation, claimId, applyRetryTick, scheduleSeekerApplyRetry]);

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
            pendingSeekerRef.current = seekerRef.current;
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
            logHandoffLive(
              [
                "publisher map create start",
                `reentry=${initializedRef.current && Boolean(map.getSource(PUBLISHER_LIVE_DEST_SOURCE))}`,
              ].join(" "),
            );

            try {
              if (!initializedRef.current || !map.getSource(PUBLISHER_LIVE_DEST_SOURCE)) {
                initializedRef.current = true;

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
                map.getCanvas().addEventListener(
                  "wheel",
                  () => {
                    pauseAutoCamera();
                  },
                  { passive: true },
                );

                ensurePublisherLiveMapSources(
                  map,
                  parkingLongitude,
                  parkingLatitude,
                  seekerRef.current,
                );
              }

              map.resize();
              pendingFocusRef.current = true;

              const pending = pendingSeekerRef.current ?? seekerRef.current;
              if (pending) {
                const applied = flushPendingSeeker(map, pending);
                if (applied) {
                  displaySeekerRef.current = {
                    lat: pending.latitude,
                    lng: pending.longitude,
                  };
                  accuracyRef.current = pending.accuracyMeters;
                }
              }

              if (mountedRef.current) {
                setMapReady(true);
              }
              logHandoffLive(
                [
                  "publisher map load",
                  `seekerLayer=${Boolean(
                    map.getLayer("publisher-live-seeker-layer") ||
                      map.getLayer("publisher-live-seeker-fallback-layer"),
                  )}`,
                ].join(" "),
              );
              logHandoffLive("publisher seeker layer ensure success");
            } catch (error) {
              initializedRef.current = false;
              mapRef.current = null;
              logHandoffLive(
                [
                  "publisher map init failed",
                  `errorMessage=${error instanceof Error ? error.message : String(error)}`,
                ].join(" "),
              );
              if (mountedRef.current) {
                setMapUnavailable(true);
              }
            }
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
