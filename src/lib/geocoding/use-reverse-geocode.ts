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
  const [addressForPublish, setAddressForPublish] = useState<string | null>(
    null,
  );
  const [isUpdating, setIsUpdating] = useState(false);

  const requestSeqRef = useRef(0);
  const inFlightKeyRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);

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

    const cached = readReverseGeocodeCache(latitude, longitude);
    if (cached) {
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        setAddressForPublish(cached.label);
        setLabel(cached.label);
        setStatus(cached.label ? "success" : "unavailable");
        setIsUpdating(false);
      }, 0);
      return () => {
        if (debounceRef.current !== null) {
          window.clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
      };
    }

    const targetKey = coordsKey(latitude, longitude);

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
          setAddressForPublish(result.label);
          setLabel(result.label);
          setStatus(result.label ? "success" : "unavailable");
          setIsUpdating(false);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          if (seq !== requestSeqRef.current) {
            return;
          }
          inFlightKeyRef.current = null;
          setAddressForPublish(null);
          setStatus("unavailable");
          setIsUpdating(false);
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
    setIsUpdating(true);
    setAddressForPublish(null);
    if (label) {
      setStatus("loading");
    }
  }

  return {
    status,
    label,
    addressForPublish,
    isUpdating,
    notifyMapMoveStart,
  };
}
