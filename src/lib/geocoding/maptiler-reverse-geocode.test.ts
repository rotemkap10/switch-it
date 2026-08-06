import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildMapTilerReverseGeocodeUrl,
  extractLocationLabelParts,
  mapTilerReverseGeocode,
} from "@/lib/geocoding/maptiler-reverse-geocode";
import { resetReverseGeocodeCacheForTests } from "@/lib/geocoding/reverse-geocode-cache";

describe("mapTilerReverseGeocode", () => {
  afterEach(() => {
    resetReverseGeocodeCacheForTests();
    vi.restoreAllMocks();
  });

  it("builds the URL with longitude before latitude and language", () => {
    const url = buildMapTilerReverseGeocodeUrl(
      { latitude: 32.0853, longitude: 34.7818 },
      "test-key",
      "en",
    );

    expect(url).toContain("/geocoding/34.7818,32.0853.json");
    expect(url).toContain("key=test-key");
    expect(url).toContain("language=en");
  });

  it("parses street, number, and city from features", () => {
    const parts = extractLocationLabelParts([
      {
        place_type: ["address"],
        text: "Dizengoff Street",
        address: "120",
        context: [{ id: "municipality.1", text: "Tel Aviv" }],
      },
    ]);

    expect(parts.street).toBe("Dizengoff Street");
    expect(parts.houseNumber).toBe("120");
    expect(parts.city).toBe("Tel Aviv");
  });

  it("returns a formatted label on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            place_type: ["address"],
            text: "Dizengoff Street",
            address: "120",
            context: [{ id: "municipality.1", text: "Tel Aviv" }],
          },
        ],
      }),
    });

    const result = await mapTilerReverseGeocode(
      { latitude: 32.0853, longitude: 34.7818 },
      { apiKey: "test-key", fetchImpl },
    );

    expect(result.label).toBe("Dizengoff Street 120, Tel Aviv");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns null for empty features", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [] }),
    });

    const result = await mapTilerReverseGeocode(
      { latitude: 32, longitude: 34 },
      { apiKey: "test-key", fetchImpl },
    );

    expect(result.label).toBeNull();
  });

  it("returns null for HTTP failures without leaking the key", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    });

    const result = await mapTilerReverseGeocode(
      { latitude: 32, longitude: 34 },
      { apiKey: "secret-key", fetchImpl },
    );

    expect(result.label).toBeNull();
  });

  it("propagates abort errors", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      mapTilerReverseGeocode(
        { latitude: 32, longitude: 34 },
        { apiKey: "test-key", signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("does not log request URLs or keys", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [] }),
    });

    await mapTilerReverseGeocode(
      { latitude: 32.0853, longitude: 34.7818 },
      { apiKey: "secret-key", fetchImpl },
    );

    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
