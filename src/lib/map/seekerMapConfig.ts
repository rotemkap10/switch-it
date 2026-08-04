export const MAP_DEFAULT_CENTER_TEL_AVIV = {
  lat: 32.167,
  lng: 34.843,
} as const;

export const MAP_DEFAULT_ZOOM = 14;
export const MAP_SELECTED_SPOT_ZOOM = 16;

/**
 * Zoom floor so the seeker map stays regionally focused (not a world view).
 * Chosen so Israel still fits comfortably on phone/desktop without feeling locked-in.
 */
export const MAP_MIN_ZOOM = 7;

/**
 * Street-level ceiling for MapTiler streets tiles / seeker browsing.
 * Selected-spot camera uses MAP_SELECTED_SPOT_ZOOM below this.
 */
export const MAP_MAX_ZOOM = 18;

export const MAP_MOVEMENT_DURATION_MS = 700;

/**
 * Product UX focus area for the seeker map (not a political border).
 *
 * Core extent is based on commonly published Israel geographic envelopes
 * (~34.27–35.90°E, ~29.49–33.36°N), then expanded with a practical margin:
 * - west: Mediterranean coastal water near Tel Aviv
 * - east/north/south: breathing room so edge pans do not feel abrupt
 *
 * MapLibre maxBounds uses [lng, lat] corners: southwest then northeast.
 */
export const MAP_SUPPORTED_BOUNDS = {
  west: 33.95,
  south: 29.35,
  east: 36.15,
  north: 33.5,
} as const;

/** MapLibre `maxBounds`: [[west, south], [east, north]] */
export const MAP_SUPPORTED_MAX_BOUNDS: [[number, number], [number, number]] = [
  [MAP_SUPPORTED_BOUNDS.west, MAP_SUPPORTED_BOUNDS.south],
  [MAP_SUPPORTED_BOUNDS.east, MAP_SUPPORTED_BOUNDS.north],
];

export function isWithinSupportedMapBounds(
  longitude: number,
  latitude: number,
): boolean {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return false;
  }

  return (
    longitude >= MAP_SUPPORTED_BOUNDS.west &&
    longitude <= MAP_SUPPORTED_BOUNDS.east &&
    latitude >= MAP_SUPPORTED_BOUNDS.south &&
    latitude <= MAP_SUPPORTED_BOUNDS.north
  );
}

// Source/layer IDs (used in MapLibre style queries)
export const MAP_SOURCES = {
  spots: "seeker-spots-src",
  destination: "seeker-destination-src",
  userLocation: "seeker-user-location-src",
  userAccuracy: "seeker-user-accuracy-src",
} as const;

export const MAP_LAYERS = {
  spotsSymbols: "seeker-spots-symbols-layer",
  destination: "seeker-destination-layer",
  userDot: "seeker-user-dot-layer",
  userAccuracy: "seeker-user-accuracy-layer",
} as const;

/**
 * Seeker basemap style (MapTiler Cloud).
 * streets-v4-pastel: soft but colorful roads/parks/water; fits sky-blue UI.
 */
export const MAPTILER_SEEKER_STYLE_ID = "streets-v4-pastel";

/** @deprecated Use MAPTILER_SEEKER_STYLE_ID */
export const MAPTILER_LIGHT_STYLE_ID = MAPTILER_SEEKER_STYLE_ID;

export function getMapTilerApiKey(): string | null {
  const key = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

export function buildMapTilerSeekerStyleUrl(): string | null {
  const apiKey = getMapTilerApiKey();
  if (!apiKey) {
    return null;
  }

  return `https://api.maptiler.com/maps/${MAPTILER_SEEKER_STYLE_ID}/style.json?key=${encodeURIComponent(
    apiKey,
  )}`;
}

/** @deprecated Use buildMapTilerSeekerStyleUrl */
export function buildMapTilerLightStyleUrl(): string | null {
  return buildMapTilerSeekerStyleUrl();
}

export function assertMapTilerStyleUrlOrNull(): string | null {
  return buildMapTilerSeekerStyleUrl();
}
