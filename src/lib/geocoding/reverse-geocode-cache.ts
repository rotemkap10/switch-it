import type { ReverseGeocodeResult } from "@/lib/geocoding/types";

const CACHE_MAX_ENTRIES = 64;
const COORD_DECIMALS = 5;

type CacheEntry = ReverseGeocodeResult;

const cache = new Map<string, CacheEntry>();

export function reverseGeocodeCacheKey(
  latitude: number,
  longitude: number,
): string {
  const lat = latitude.toFixed(COORD_DECIMALS);
  const lng = longitude.toFixed(COORD_DECIMALS);
  return `${lng},${lat}`;
}

export function readReverseGeocodeCache(
  latitude: number,
  longitude: number,
): ReverseGeocodeResult | null {
  const key = reverseGeocodeCacheKey(latitude, longitude);
  const hit = cache.get(key);
  if (!hit) {
    return null;
  }

  // Refresh LRU order.
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

export function writeReverseGeocodeCache(
  latitude: number,
  longitude: number,
  result: ReverseGeocodeResult,
): void {
  const key = reverseGeocodeCacheKey(latitude, longitude);
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, result);

  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    cache.delete(oldest);
  }
}

/** Test-only reset. */
export function resetReverseGeocodeCacheForTests(): void {
  cache.clear();
}
