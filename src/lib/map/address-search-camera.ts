import {
  MAP_ADDRESS_SEARCH_ZOOM,
  MAP_DEFAULT_ZOOM,
  MAP_SELECTED_SPOT_ZOOM,
} from "@/lib/map/seekerMapConfig";

const PRECISE_TYPES = new Set(["address"]);
const STREET_TYPES = new Set(["road", "street"]);
const BROAD_TYPES = new Set([
  "locality",
  "place",
  "region",
  "country",
  "district",
  "municipality",
  "neighborhood",
  "poi",
]);

/**
 * Camera zoom for a one-shot address-search selection.
 * Precise house numbers get street/building level; cities stay wide.
 */
export function zoomForForwardGeocodeResult(
  placeTypes: readonly string[] | undefined,
): number {
  const types = placeTypes ?? [];
  if (types.some((type) => PRECISE_TYPES.has(type))) {
    return MAP_ADDRESS_SEARCH_ZOOM;
  }
  if (types.some((type) => STREET_TYPES.has(type))) {
    return MAP_SELECTED_SPOT_ZOOM;
  }
  if (types.some((type) => BROAD_TYPES.has(type))) {
    return MAP_DEFAULT_ZOOM;
  }
  return MAP_ADDRESS_SEARCH_ZOOM;
}
