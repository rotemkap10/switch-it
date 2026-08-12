import { formatLocationLabel } from "@/lib/geocoding/format-location-label";
import {
  extractLocationLabelParts,
} from "@/lib/geocoding/maptiler-reverse-geocode";
import { getMapTilerApiKey } from "@/lib/map/seekerMapConfig";

const MAPTILER_GEOCODING_BASE = "https://api.maptiler.com/geocoding";
const DEFAULT_LANGUAGE = "en";
const DEFAULT_LIMIT = 5;
const REQUEST_TIMEOUT_MS = 7000;

export type ForwardGeocodeResult = {
  latitude: number;
  longitude: number;
  label: string;
};

type MapTilerForwardFeature = {
  place_type?: string[];
  text?: string;
  address?: string;
  context?: Array<{ id?: string; text?: string }>;
  center?: [number, number]; // [lng, lat]
  place_name?: string;
  relevance?: number;
};

type MapTilerSearchResults = {
  features?: MapTilerForwardFeature[];
};

function buildBboxParam(bbox: {
  west: number;
  south: number;
  east: number;
  north: number;
}): string {
  // MapTiler uses bbox=left,bottom,right,top
  return `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
}

export function buildMapTilerForwardGeocodeUrl(
  query: string,
  apiKey: string,
  options?: {
    language?: string;
    limit?: number;
    country?: string;
    bbox?: { west: number; south: number; east: number; north: number };
    proximity?: { lon: number; lat: number } | string;
    types?: string[];
    autocomplete?: boolean;
    fuzzyMatch?: boolean;
  },
): string {
  const {
    language = DEFAULT_LANGUAGE,
    limit = DEFAULT_LIMIT,
    country,
    bbox,
    proximity,
    types,
    autocomplete,
    fuzzyMatch,
  } =
    options ?? {};

  const params = new URLSearchParams({
    key: apiKey,
    language,
    limit: String(limit),
  });

  if (country) {
    params.set("country", country.toLowerCase());
  }
  if (bbox) {
    params.set("bbox", buildBboxParam(bbox));
  }
  if (proximity) {
    const value =
      typeof proximity === "string"
        ? proximity
        : `${proximity.lon},${proximity.lat}`;
    params.set("proximity", value);
  }
  if (types && types.length > 0) {
    params.set("types", types.join(","));
  }
  if (autocomplete !== undefined) {
    params.set("autocomplete", String(Boolean(autocomplete)));
  }
  if (fuzzyMatch !== undefined) {
    params.set("fuzzyMatch", String(Boolean(fuzzyMatch)));
  }

  // MapTiler forward geocoding: /geocoding/<query>.json
  const encoded = encodeURIComponent(query.trim());
  return `${MAPTILER_GEOCODING_BASE}/${encoded}.json?${params.toString()}`;
}

export async function mapTilerForwardGeocodeSearch(
  query: string,
  options?: {
    limit?: number;
    country?: string;
    bbox?: { west: number; south: number; east: number; north: number };
    proximity?: { lon: number; lat: number } | string;
    language?: string;
    types?: string[];
    autocomplete?: boolean;
    fuzzyMatch?: boolean;
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
  },
): Promise<ForwardGeocodeResult[]> {
  const apiKey = getMapTilerApiKey();
  if (!apiKey) {
    return [];
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const onExternalAbort = () => controller.abort();
  if (options?.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeoutId);
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    }
    options.signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  const url = buildMapTilerForwardGeocodeUrl(query, apiKey, options);

  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) {
      return [];
    }

    let payload: MapTilerSearchResults;
    try {
      payload = (await response.json()) as MapTilerSearchResults;
    } catch {
      return [];
    }

    const features = payload.features ?? [];
    type Scored = ForwardGeocodeResult & { score: number };
    const results: Scored[] = [];

    for (const feature of features) {
      const center = feature.center;
      const longitude = center?.[0] ?? NaN;
      const latitude = center?.[1] ?? NaN;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        continue;
      }

      const relevance =
        feature.relevance != null && Number.isFinite(feature.relevance)
          ? feature.relevance
          : null;
      // MapTiler returns relevance (0..1). Use it as a soft signal; avoid
      // filtering too aggressively so street-only centroids still work.
      if (relevance != null && relevance < 0.2) {
        continue;
      }

      const placeTypes = feature.place_type ?? [];
      const kindBoost = placeTypes.includes("address")
        ? 1.6
        : placeTypes.includes("road")
          ? 1.3
          : placeTypes.includes("street")
            ? 1.2
            : placeTypes.includes("locality") || placeTypes.includes("place")
              ? 1.0
              : 0.7;

      const parts = extractLocationLabelParts([
        feature as Parameters<typeof extractLocationLabelParts>[0][number],
      ]);
      const label =
        formatLocationLabel(parts) ??
        feature.text?.trim() ??
        feature.place_name?.trim() ??
        null;

      if (!label) {
        continue;
      }

      const score = kindBoost + (relevance ?? 0);
      results.push({ latitude, longitude, label, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, options?.limit ?? DEFAULT_LIMIT);
  } finally {
    clearTimeout(timeoutId);
    options?.signal?.removeEventListener("abort", onExternalAbort);
  }
}

