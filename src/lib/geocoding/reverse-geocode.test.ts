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

  it("does not cache failed lookups so a later retry can succeed", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          features: [
            {
              place_type: ["address"],
              text: "Dizengoff Street",
              address: "123",
              context: [{ id: "municipality.1", text: "Tel Aviv" }],
            },
          ],
        }),
      } as Response);

    const first = await reverseGeocode(
      { latitude: 32.0853, longitude: 34.7818 },
      { fetchImpl },
    );
    expect(first.label).toBeNull();

    const second = await reverseGeocode(
      { latitude: 32.0853, longitude: 34.7818 },
      { fetchImpl },
    );
    expect(second.label).toBe("Dizengoff Street 123, Tel Aviv");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
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
