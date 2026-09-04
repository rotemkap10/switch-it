import { describe, expect, it } from "vitest";

import { lngLatBoundsFromPoints } from "@/lib/map/lnglat-bounds";

describe("lngLatBoundsFromPoints", () => {
  it("returns null for empty or invalid points so callers never fitBounds", () => {
    expect(lngLatBoundsFromPoints([])).toBeNull();
    expect(lngLatBoundsFromPoints([null, undefined])).toBeNull();
    expect(
      lngLatBoundsFromPoints([{ longitude: Number.NaN, latitude: 32.08 }]),
    ).toBeNull();
    expect(
      lngLatBoundsFromPoints([{ longitude: 0, latitude: 0 }]),
    ).toBeNull();
  });

  it("returns null for a single meaningful point", () => {
    expect(
      lngLatBoundsFromPoints([{ longitude: 34.7818, latitude: 32.0853 }]),
    ).toBeNull();
  });

  it("returns null when two points are the same location", () => {
    const point = { longitude: 34.7818, latitude: 32.0853 };
    expect(lngLatBoundsFromPoints([point, { ...point }])).toBeNull();
  });

  it("normalizes inverted corners to southwest then northeast", () => {
    expect(
      lngLatBoundsFromPoints([
        { longitude: 35.0, latitude: 32.5 },
        { longitude: 34.7, latitude: 31.8 },
      ]),
    ).toEqual([
      [34.7, 31.8],
      [35.0, 32.5],
    ]);
  });
});
