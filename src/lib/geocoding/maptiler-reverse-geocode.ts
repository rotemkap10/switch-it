import { formatLocationLabel } from "@/lib/geocoding/format-location-label";
import type { LocationLabelParts } from "@/lib/geocoding/types";
import type { ReverseGeocodeInput, ReverseGeocodeResult } from "@/lib/geocoding/types";

const MAPTILER_GEOCODING_BASE = "https://api.maptiler.com/geocoding";
const DEFAULT_LANGUAGE = "en";
const REQUEST_TIMEOUT_MS = 7000;

type MapTilerContext = {
  id?: string;
  text?: string;
};

type MapTilerFeature = {
  id?: string;
  text?: string;
  address?: string;
  place_type?: string[];
  place_name?: string;
  context?: MapTilerContext[];
};

type MapTilerSearchResults = {
  features?: MapTilerFeature[];
};

function contextKind(context: MapTilerContext): string | null {
  const id = context.id;
  if (!id) {
    return null;
  }
  const dot = id.indexOf(".");
  return dot === -1 ? id : id.slice(0, dot);
}

function applyContextPart(
  parts: LocationLabelParts,
  kind: string | null,
  text: string | null,
): void {
  if (!kind || !text) {
    return;
  }

  if (kind === "country") {
    return;
  }

  if (
    (kind === "municipality" ||
      kind === "locality" ||
      kind === "place" ||
      kind === "city") &&
    !parts.city
  ) {
    parts.city = text;
    return;
  }

  if (kind === "neighbourhood" && !parts.neighborhood) {
    parts.neighborhood = text;
    return;
  }

  if (kind === "street" && !parts.street) {
    parts.street = text;
  }
}

function applyFeatureParts(
  parts: LocationLabelParts,
  feature: MapTilerFeature,
): void {
  const types = feature.place_type ?? [];
  const text = feature.text?.trim() ?? null;

  if (
    // Forward geocoding can return streets as `road` (not `street`).
    (types.includes("address") ||
      types.includes("street") ||
      types.includes("road")) &&
    text &&
    !parts.street
  ) {
    parts.street = text;
  }

  if (feature.address?.trim() && !parts.houseNumber) {
    parts.houseNumber = feature.address.trim();
  }

  if (types.includes("poi") && text && !parts.namedPlace) {
    parts.namedPlace = text;
  }

  if (types.includes("neighbourhood") && text && !parts.neighborhood) {
    parts.neighborhood = text;
  }

  if (
    (types.includes("municipality") ||
      types.includes("locality") ||
      types.includes("place")) &&
    text &&
    !parts.city
  ) {
    parts.city = text;
  }

  for (const ctx of feature.context ?? []) {
    applyContextPart(parts, contextKind(ctx), ctx.text?.trim() ?? null);
  }
}

export function extractLocationLabelParts(
  features: MapTilerFeature[],
): LocationLabelParts {
  const parts: LocationLabelParts = {};

  for (const feature of features) {
    applyFeatureParts(parts, feature);
  }

  return parts;
}

export function buildMapTilerReverseGeocodeUrl(
  input: ReverseGeocodeInput,
  apiKey: string,
  language = DEFAULT_LANGUAGE,
): string {
  const { longitude, latitude } = input;
  const params = new URLSearchParams({
    key: apiKey,
    language,
    limit: "5",
  });

  return `${MAPTILER_GEOCODING_BASE}/${longitude},${latitude}.json?${params.toString()}`;
}

export async function mapTilerReverseGeocode(
  input: ReverseGeocodeInput,
  options: {
    apiKey: string;
    language?: string;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
    timeoutMs?: number;
  },
): Promise<ReverseGeocodeResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeoutId);
      throw new DOMException("Aborted", "AbortError");
    }
    options.signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    const response = await fetchImpl(
      buildMapTilerReverseGeocodeUrl(
        input,
        options.apiKey,
        options.language,
      ),
      { signal: controller.signal },
    );

    if (!response.ok) {
      return { label: null };
    }

    let payload: MapTilerSearchResults;
    try {
      payload = (await response.json()) as MapTilerSearchResults;
    } catch {
      return { label: null };
    }

    const features = payload.features ?? [];
    if (features.length === 0) {
      return { label: null };
    }

    const label = formatLocationLabel(extractLocationLabelParts(features));
    return { label };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return { label: null };
  } finally {
    clearTimeout(timeoutId);
    if (options.signal) {
      options.signal.removeEventListener("abort", onExternalAbort);
    }
  }
}
