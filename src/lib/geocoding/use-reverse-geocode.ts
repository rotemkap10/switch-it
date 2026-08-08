"use client";

import { useEffect, useRef, useState } from "react";

import { readReverseGeocodeCache } from "@/lib/geocoding/reverse-geocode-cache";
import { reverseGeocode } from "@/lib/geocoding/reverse-geocode";
import type { ReverseGeocodeLookupStatus } from "@/lib/geocoding/types";

const DEBOUNCE_MS = 750;

function coordsKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

export type UseReverseGeocodeResult = {
  status: ReverseGeocodeLookupStatus;
  /** Latest resolved label for display; may remain while a newer lookup runs. */
  label: string | null;
  /** Sanitized label to submit with publication (null when unavailable). */
  addressForPublish: string | null;
  /** True while the map is moving and the label may be stale. */
  isUpdating: boolean;
  notifyMapMoveStart: () => void;
  /** Call when a user gesture ended without changing coordinates. */
  notifyMapMoveSettled: () => void;
};

/**
 * Debounced reverse geocoding for the publisher location picker.
 * Coordinates remain authoritative; label is display-only enrichment.
 */
export function useReverseGeocode(
  latitude: number | null,
  longitude: number | null,
  enabled: boolean,
): UseReverseGeocodeResult {
  const [status, setStatus] = useState<ReverseGeocodeLookupStatus>("idle");
  const [label, setLabel] = useState<string | null>(null);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [moveInProgress, setMoveInProgress] = useState(false);

  const requestSeqRef = useRef(0);
  const inFlightKeyRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);

  const currentKey =
    enabled && latitude !== null && longitude !== null
      ? coordsKey(latitude, longitude)
      : null;
  const coordsMatchResolved =
    currentKey !== null && currentKey === resolvedKey;
  const addressForPublish =
    !moveInProgress && coordsMatchResolved ? label : null;
  const isUpdating =
    Boolean(currentKey) &&
    (moveInProgress || !coordsMatchResolved || status === "loading");

  useEffect(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
    inFlightKeyRef.current = null;

    if (!enabled || latitude === null || longitude === null) {
      return;
    }

    const targetKey = coordsKey(latitude, longitude);
    const cached = readReverseGeocodeCache(latitude, longitude);
    if (cached?.label) {
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        setLabel(cached.label);
        setResolvedKey(targetKey);
        setStatus("success");
      }, 0);
      return () => {
        if (debounceRef.current !== null) {
          window.clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
      };
    }

    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;

      if (inFlightKeyRef.current === targetKey) {
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      inFlightKeyRef.current = targetKey;

      const seq = ++requestSeqRef.current;
      setStatus("loading");

      void reverseGeocode(
        { latitude, longitude },
        { signal: controller.signal },
      )
        .then((result) => {
          if (seq !== requestSeqRef.current) {
            return;
          }
          if (coordsKey(latitude, longitude) !== targetKey) {
            return;
          }

          inFlightKeyRef.current = null;
          setLabel(result.label);
          setResolvedKey(targetKey);
          setStatus(result.label ? "success" : "unavailable");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          if (seq !== requestSeqRef.current) {
            return;
          }
          inFlightKeyRef.current = null;
          setLabel(null);
          setResolvedKey(targetKey);
          setStatus("unavailable");
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [latitude, longitude, enabled]);

  function notifyMapMoveStart() {
    setMoveInProgress(true);
    if (label) {
      setStatus("loading");
    }
  }

  function notifyMapMoveSettled() {
    setMoveInProgress(false);
    if (label) {
      setStatus("success");
    }
  }

  return {
    status,
    label,
    addressForPublish,
    isUpdating,
    notifyMapMoveStart,
    notifyMapMoveSettled,
  };
}
