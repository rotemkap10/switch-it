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
  },
): string {
  const { language = DEFAULT_LANGUAGE, limit = DEFAULT_LIMIT, country, bbox } =
    options ?? {};

  const params = new URLSearchParams({
    key: apiKey,
    language,
    limit: String(limit),
  });

  if (country) {
    params.set("country", country);
  }
  if (bbox) {
    params.set("bbox", buildBboxParam(bbox));
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
    const results: ForwardGeocodeResult[] = [];

    for (const feature of features) {
      const center = feature.center;
      const longitude = center?.[0] ?? NaN;
      const latitude = center?.[1] ?? NaN;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        continue;
      }

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

      results.push({ latitude, longitude, label });
    }

    return results.slice(0, options?.limit ?? DEFAULT_LIMIT);
  } finally {
    clearTimeout(timeoutId);
    options?.signal?.removeEventListener("abort", onExternalAbort);
  }
}

