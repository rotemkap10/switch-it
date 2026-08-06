import { afterEach, describe, expect, it, vi } from "vitest";

import { reverseGeocode } from "@/lib/geocoding/reverse-geocode";
import {
  readReverseGeocodeCache,
  resetReverseGeocodeCacheForTests,
  writeReverseGeocodeCache,
} from "@/lib/geocoding/reverse-geocode-cache";

vi.mock("@/lib/map/seekerMapConfig", () => ({
  getMapTilerApiKey: () => "test-key",
}));

describe("reverseGeocode cache", () => {
  afterEach(() => {
    resetReverseGeocodeCacheForTests();
    vi.restoreAllMocks();
  });

  it("reuses cached nearby coordinates", async () => {
    writeReverseGeocodeCache(32.0853124, 34.7818124, {
      label: "Cached Street, Tel Aviv",
    });

    expect(readReverseGeocodeCache(32.08531241, 34.78181239)).toEqual({
      label: "Cached Street, Tel Aviv",
    });

    const fetchImpl = vi.fn();
    const result = await reverseGeocode(
      { latitude: 32.0853124, longitude: 34.7818124 },
      { fetchImpl },
    );

    expect(result.label).toBe("Cached Street, Tel Aviv");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
