import { isWithinSupportedMapBounds } from "@/lib/map/seekerMapConfig";

export type LngLatPoint = {
  longitude: number;
  latitude: number;
};

const SAME_POINT_EPSILON = 1e-7;

function isUsablePoint(point: LngLatPoint | null | undefined): point is LngLatPoint {
  return (
    !!point &&
    Number.isFinite(point.longitude) &&
    Number.isFinite(point.latitude) &&
    isWithinSupportedMapBounds(point.longitude, point.latitude)
  );
}

/**
 * MapLibre `fitBounds` requires southwest then northeast, each `[lng, lat]`.
 * Returns null when there are not two distinct in-bounds points — never
 * invent country-wide or inverted bounds.
 */
export function lngLatBoundsFromPoints(
  points: ReadonlyArray<LngLatPoint | null | undefined>,
): [[number, number], [number, number]] | null {
  const valid = points.filter(isUsablePoint);
  if (valid.length < 2) {
    return null;
  }

  let west = valid[0].longitude;
  let south = valid[0].latitude;
  let east = valid[0].longitude;
  let north = valid[0].latitude;

  for (const point of valid.slice(1)) {
    west = Math.min(west, point.longitude);
    south = Math.min(south, point.latitude);
    east = Math.max(east, point.longitude);
    north = Math.max(north, point.latitude);
  }

  if (
    Math.abs(east - west) < SAME_POINT_EPSILON &&
    Math.abs(north - south) < SAME_POINT_EPSILON
  ) {
    return null;
  }

  return [
    [west, south],
    [east, north],
  ];
}
