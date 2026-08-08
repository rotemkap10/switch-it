import { mapTilerReverseGeocode } from "@/lib/geocoding/maptiler-reverse-geocode";
import {
  readReverseGeocodeCache,
  writeReverseGeocodeCache,
} from "@/lib/geocoding/reverse-geocode-cache";
import type { ReverseGeocodeInput, ReverseGeocodeResult } from "@/lib/geocoding/types";
import { getMapTilerApiKey } from "@/lib/map/seekerMapConfig";

export type ReverseGeocodeOptions = {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  /** Skip session cache (tests). */
  skipCache?: boolean;
};

/**
 * Provider-neutral reverse geocoding entry point.
 * Uses the MapTiler adapter today; UI must not depend on provider details.
 */
export async function reverseGeocode(
  input: ReverseGeocodeInput,
  options: ReverseGeocodeOptions = {},
): Promise<ReverseGeocodeResult> {
  const { latitude, longitude } = input;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { label: null };
  }

  if (!options.skipCache) {
    const cached = readReverseGeocodeCache(latitude, longitude);
    // Do not reuse failed lookups — a later retry may succeed.
    if (cached?.label) {
      return cached;
    }
  }

  const apiKey = getMapTilerApiKey();
  if (!apiKey) {
    return { label: null };
  }

  const result = await mapTilerReverseGeocode(input, {
    apiKey,
    signal: options.signal,
    fetchImpl: options.fetchImpl,
  });

  if (!options.skipCache && result.label) {
    writeReverseGeocodeCache(latitude, longitude, result);
  }

  return result;
}
