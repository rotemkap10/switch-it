import { describe, expect, it } from "vitest";

import {
  buildMapTilerSeekerStyleUrl,
  getMapTilerApiKey,
  isWithinSupportedMapBounds,
  MAP_ADDRESS_SEARCH_ZOOM,
  MAP_DEFAULT_CENTER_TEL_AVIV,
  MAP_DEFAULT_ZOOM,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_SUPPORTED_BOUNDS,
  MAP_SUPPORTED_MAX_BOUNDS,
  MAPTILER_SEEKER_STYLE_ID,
} from "@/lib/map/seekerMapConfig";

describe("seekerMapConfig", () => {
  it("returns null style url when NEXT_PUBLIC_MAPTILER_API_KEY is missing", () => {
    const original = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
    delete process.env.NEXT_PUBLIC_MAPTILER_API_KEY;

    expect(getMapTilerApiKey()).toBeNull();
    expect(buildMapTilerSeekerStyleUrl()).toBeNull();

    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = original;
  });

  it("builds a MapTiler pastel streets style url from NEXT_PUBLIC_MAPTILER_API_KEY", () => {
    const original = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = "test-key";

    const url = buildMapTilerSeekerStyleUrl();
    expect(url).toContain(`maps/${MAPTILER_SEEKER_STYLE_ID}/style.json`);
    expect(MAPTILER_SEEKER_STYLE_ID).toBe("streets-v4-pastel");
    expect(url).toContain("key=test-key");

    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = original;
  });

  it("defines Israel-focused UX bounds in lng/lat order for MapLibre", () => {
    expect(MAP_SUPPORTED_MAX_BOUNDS).toEqual([
      [MAP_SUPPORTED_BOUNDS.west, MAP_SUPPORTED_BOUNDS.south],
      [MAP_SUPPORTED_BOUNDS.east, MAP_SUPPORTED_BOUNDS.north],
    ]);
    expect(MAP_SUPPORTED_BOUNDS.west).toBeLessThan(MAP_SUPPORTED_BOUNDS.east);
    expect(MAP_SUPPORTED_BOUNDS.south).toBeLessThan(MAP_SUPPORTED_BOUNDS.north);
    expect(MAP_MIN_ZOOM).toBe(7);
    expect(MAP_MAX_ZOOM).toBe(18);
    expect(MAP_ADDRESS_SEARCH_ZOOM).toBe(18);
    expect(MAP_ADDRESS_SEARCH_ZOOM).toBeGreaterThan(MAP_DEFAULT_ZOOM);
    expect(MAP_MIN_ZOOM).toBeLessThan(MAP_MAX_ZOOM);

    expect(
      isWithinSupportedMapBounds(
        MAP_DEFAULT_CENTER_TEL_AVIV.lng,
        MAP_DEFAULT_CENTER_TEL_AVIV.lat,
      ),
    ).toBe(true);
    // Tel Aviv city center — not the old Sokolov/Herzliya development pin.
    expect(MAP_DEFAULT_CENTER_TEL_AVIV.lat).toBeCloseTo(32.0853, 3);
    expect(MAP_DEFAULT_CENTER_TEL_AVIV.lng).toBeCloseTo(34.7818, 3);
    expect(MAP_DEFAULT_CENTER_TEL_AVIV).not.toEqual({ lat: 32.167, lng: 34.843 });
    expect(isWithinSupportedMapBounds(0, 0)).toBe(false);
    expect(isWithinSupportedMapBounds(Number.NaN, 32)).toBe(false);
  });
});
