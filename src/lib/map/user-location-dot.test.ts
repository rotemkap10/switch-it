import { describe, expect, it, vi } from "vitest";

import {
  PICKER_USER_LOCATION_IDS,
  SEEKER_USER_LOCATION_IDS,
  syncUserLocationDot,
} from "@/lib/map/user-location-dot";
import { MAP_LAYERS, MAP_SOURCES } from "@/lib/map/seekerMapConfig";

function createMap() {
  const sources = new Map<string, { type: string; setData: ReturnType<typeof vi.fn> }>();
  const layers = new Set<string>();
  return {
    addSource: vi.fn((id: string) => {
      sources.set(id, { type: "geojson", setData: vi.fn() });
    }),
    getSource: vi.fn((id: string) => sources.get(id)),
    addLayer: vi.fn((layer: { id: string }) => {
      layers.add(layer.id);
    }),
    getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
    project: vi.fn(() => ({ x: 0, y: 0 })),
    sources,
  };
}

describe("syncUserLocationDot", () => {
  it("uses the seeker source and layer IDs", () => {
    expect(SEEKER_USER_LOCATION_IDS).toEqual({
      dotSource: MAP_SOURCES.userLocation,
      accuracySource: MAP_SOURCES.userAccuracy,
      dotLayer: MAP_LAYERS.userDot,
      accuracyLayer: MAP_LAYERS.userAccuracy,
    });
  });

  it("adds the blue dot when a location is available", () => {
    const map = createMap();
    syncUserLocationDot(map as never, PICKER_USER_LOCATION_IDS, {
      latitude: 32.08,
      longitude: 34.78,
      accuracy: 10,
    });

    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: PICKER_USER_LOCATION_IDS.dotLayer }),
    );
    expect(map.sources.get(PICKER_USER_LOCATION_IDS.dotSource)?.setData).toHaveBeenCalledWith(
      expect.objectContaining({
        features: [
          expect.objectContaining({
            geometry: { type: "Point", coordinates: [34.78, 32.08] },
          }),
        ],
      }),
    );
  });

  it("does not add layers when location is missing", () => {
    const map = createMap();
    syncUserLocationDot(map as never, PICKER_USER_LOCATION_IDS, null);
    expect(map.addSource).not.toHaveBeenCalled();
    expect(map.addLayer).not.toHaveBeenCalled();
  });

  it("does not throw when the map is missing", () => {
    expect(() => {
      syncUserLocationDot(null, PICKER_USER_LOCATION_IDS, {
        latitude: 32.08,
        longitude: 34.78,
      });
    }).not.toThrow();
  });
});
