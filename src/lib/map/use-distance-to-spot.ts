"use client";

import { useEffect, useState } from "react";

import {
  formatDistanceAway,
  haversineDistanceMeters,
  isValidLatLng,
  type LatLng,
} from "@/lib/map/distance";

/**
 * Optional straight-line distance from the seeker's device to a parking spot.
 * Uses a low-priority watch so it does not affect publisher GPS publishing.
 * Permission is not required; returns null when location is unavailable.
 */
export function useDistanceToSpot(
  destination: LatLng | null | undefined,
): { label: string | null } {
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const destLat = destination?.latitude;
  const destLng = destination?.longitude;
  const destValid =
    destLat != null &&
    destLng != null &&
    isValidLatLng({ latitude: destLat, longitude: destLng })
      ? { latitude: destLat, longitude: destLng }
      : null;

  useEffect(() => {
    if (
      destLat == null ||
      destLng == null ||
      !isValidLatLng({ latitude: destLat, longitude: destLng })
    ) {
      return;
    }
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      return;
    }
    if (!("geolocation" in navigator) || !navigator.geolocation) {
      return;
    }

    let watchId: number | null = null;
    try {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          setOrigin({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          setOrigin(null);
          if (watchId !== null && navigator.geolocation) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
          }
        },
        {
          enableHighAccuracy: false,
          timeout: 8_000,
          maximumAge: 30_000,
        },
      );
    } catch {
      return;
    }

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [destLat, destLng]);

  if (!destValid || !isValidLatLng(origin)) {
    return { label: null };
  }

  const label = formatDistanceAway(haversineDistanceMeters(origin, destValid));
  return { label: label.length > 0 ? label : null };
}
