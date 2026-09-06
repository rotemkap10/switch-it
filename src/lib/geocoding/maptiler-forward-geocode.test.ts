import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mapTilerForwardGeocodeSearch } from "@/lib/geocoding/maptiler-forward-geocode";

describe("mapTilerForwardGeocodeSearch", () => {
  const originalKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("labels a house-number hit as street, number, and city", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            place_type: ["address"],
            text: "דיזנגוף",
            address: "23",
            center: [34.774, 32.075],
            relevance: 0.98,
            context: [{ id: "municipality.1", text: "תל אביב-יפו" }],
          },
        ],
      }),
    });

    const results = await mapTilerForwardGeocodeSearch("דיזנגוף 23", {
      language: "he",
      fetchImpl,
    });

    expect(results[0]).toEqual(
      expect.objectContaining({
        label: "דיזנגוף 23, תל אביב-יפו",
        placeTypes: ["address"],
        latitude: 32.075,
        longitude: 34.774,
      }),
    );
  });

  it("falls back to the street when no house number exists", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            place_type: ["road"],
            text: "דיזנגוף",
            center: [34.775, 32.08],
            relevance: 0.9,
            context: [{ id: "municipality.1", text: "תל אביב-יפו" }],
          },
        ],
      }),
    });

    const results = await mapTilerForwardGeocodeSearch("דיזנגוף 23", {
      language: "he",
      fetchImpl,
    });

    expect(results[0]).toEqual(
      expect.objectContaining({
        label: "דיזנגוף, תל אביב-יפו",
        placeTypes: ["road"],
      }),
    );
  });

  it("ranks a house-number hit above the same street", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            place_type: ["road"],
            text: "דיזנגוף",
            center: [34.775, 32.08],
            relevance: 0.95,
            context: [{ id: "municipality.1", text: "תל אביב-יפו" }],
          },
          {
            place_type: ["address"],
            text: "דיזנגוף",
            address: "23",
            center: [34.774, 32.075],
            relevance: 0.9,
            context: [{ id: "municipality.1", text: "תל אביב-יפו" }],
          },
        ],
      }),
    });

    const results = await mapTilerForwardGeocodeSearch("דיזנגוף 23", {
      language: "he",
      fetchImpl,
    });

    expect(results.map((result) => result.label)).toEqual([
      "דיזנגוף 23, תל אביב-יפו",
      "דיזנגוף, תל אביב-יפו",
    ]);
  });
});
