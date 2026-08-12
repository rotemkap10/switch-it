import { MAP_SELECTED_SPOT_ZOOM } from "@/lib/map/seekerMapConfig";

export type PublisherHandoffFocusPoint = {
  longitude: number;
  latitude: number;
};

export type PublisherHandoffMapCamera = {
  resize?: () => void;
  fitBounds: (
    bounds: [[number, number], [number, number]],
    options?: { padding?: number; maxZoom?: number; duration?: number },
  ) => void;
  easeTo: (options: {
    center: [number, number];
    zoom?: number;
    duration?: number;
    essential?: boolean;
  }) => void;
};

export type FocusPublisherHandoffOptions = {
  reducedMotion?: boolean;
  zoom?: number;
  durationMs?: number;
};

/** MapLibre LngLatBounds: southwest then northeast, each [lng, lat]. */
export function publisherHandoffFitBounds(
  parking: PublisherHandoffFocusPoint,
  seeker: PublisherHandoffFocusPoint,
): [[number, number], [number, number]] {
  return [
    [
      Math.min(parking.longitude, seeker.longitude),
      Math.min(parking.latitude, seeker.latitude),
    ],
    [
      Math.max(parking.longitude, seeker.longitude),
      Math.max(parking.latitude, seeker.latitude),
    ],
  ];
}

/**
 * Focus the publisher handoff map on the parking spot, plus the seeker's
 * last-known/live point when available. Does not use device GPS.
 */
export function focusPublisherHandoffCamera(
  map: PublisherHandoffMapCamera,
  parking: PublisherHandoffFocusPoint,
  seeker: PublisherHandoffFocusPoint | null,
  options: FocusPublisherHandoffOptions = {},
): void {
  map.resize?.();
  const duration = options.reducedMotion ? 0 : (options.durationMs ?? 400);

  if (!seeker) {
    map.easeTo({
      center: [parking.longitude, parking.latitude],
      zoom: options.zoom ?? MAP_SELECTED_SPOT_ZOOM,
      duration,
      essential: true,
    });
    return;
  }

  map.fitBounds(publisherHandoffFitBounds(parking, seeker), {
    padding: 48,
    maxZoom: options.zoom ?? MAP_SELECTED_SPOT_ZOOM,
    duration,
  });
}
