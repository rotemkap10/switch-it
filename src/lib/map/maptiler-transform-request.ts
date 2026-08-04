import type { RequestTransformFunction } from "maplibre-gl";

import { getMapTilerApiKey } from "@/lib/map/seekerMapConfig";

/**
 * Ensure MapTiler Cloud asset requests (tiles, glyphs, sprites) include the API key.
 * Style JSON URLs already carry `?key=`, but sprite/glyph/source URLs from the
 * style document sometimes omit it — without the key, sprites 401/403 and every
 * POI/shield icon reports styleimagemissing.
 */
export function createMapTilerTransformRequest(
  apiKey: string | null = getMapTilerApiKey(),
): RequestTransformFunction | undefined {
  if (!apiKey) {
    return undefined;
  }

  return (url) => {
    try {
      const parsed = new URL(url);
      if (
        parsed.hostname === "api.maptiler.com" &&
        !parsed.searchParams.has("key")
      ) {
        parsed.searchParams.set("key", apiKey);
        return { url: parsed.toString() };
      }
    } catch {
      // Leave non-URL strings untouched.
    }
    return { url };
  };
}

/** Sanitize a MapTiler URL for logs — never include the API key. */
export function sanitizeMapTilerUrl(url: string): {
  host: string;
  path: string;
  hasKeyParam: boolean;
} {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.host,
      path: parsed.pathname,
      hasKeyParam: parsed.searchParams.has("key"),
    };
  } catch {
    return { host: "", path: "(unparseable)", hasKeyParam: false };
  }
}
