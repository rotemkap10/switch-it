import { describe, expect, it, vi } from "vitest";

import {
  PICKER_USER_LOCATION_IDS,
  SEEKER_USER_LOCATION_IDS,
  USER_LOCATION_DOT_RADIUS_PX,
  syncUserLocationDot,
} from "@/lib/map/user-location-dot";
import { MAP_LAYERS, MAP_SOURCES } from "@/lib/map/seekerMapConfig";

function createMap() {
  const sources = new Map<string, { type: string; setData: ReturnType<typeof vi.fn> }>();
  const layers = new Map<string, { id: string; paint?: Record<string, unknown> }>();
  return {
    addSource: vi.fn((id: string) => {
      sources.set(id, { type: "geojson", setData: vi.fn() });
    }),
    getSource: vi.fn((id: string) => sources.get(id)),
    addLayer: vi.fn((layer: { id: string; paint?: Record<string, unknown> }) => {
      layers.set(layer.id, layer);
    }),
    getLayer: vi.fn((id: string) => layers.get(id)),
    project: vi.fn(() => ({ x: 0, y: 0 })),
    sources,
    layers,
  };
}

describe("syncUserLocationDot", () => {
  it("uses shared seeker/picker source and layer IDs without accuracy halo IDs", () => {
    expect(SEEKER_USER_LOCATION_IDS).toEqual({
      dotSource: MAP_SOURCES.userLocation,
      dotLayer: MAP_LAYERS.userDot,
    });
    expect(PICKER_USER_LOCATION_IDS).toEqual(SEEKER_USER_LOCATION_IDS);
    expect(SEEKER_USER_LOCATION_IDS).not.toHaveProperty("accuracySource");
    expect(SEEKER_USER_LOCATION_IDS).not.toHaveProperty("accuracyLayer");
  });

  it("adds the blue dot when a location is available", () => {
    const map = createMap();
    syncUserLocationDot(map as never, PICKER_USER_LOCATION_IDS, {
      latitude: 32.08,
      longitude: 34.78,
      accuracy: 10,
    });

    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: PICKER_USER_LOCATION_IDS.dotLayer,
        paint: expect.objectContaining({
          "circle-radius": USER_LOCATION_DOT_RADIUS_PX,
          "circle-color": "#55bff3",
          "circle-stroke-color": "#ffffff",
        }),
      }),
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

  it("does not render a GPS accuracy halo/circle layer", () => {
    const map = createMap();
    syncUserLocationDot(map as never, SEEKER_USER_LOCATION_IDS, {
      latitude: 32.08,
      longitude: 34.78,
      accuracy: 250,
    });

    const layerIds = [...map.layers.keys()];
    expect(layerIds).toEqual([MAP_LAYERS.userDot]);
    expect(layerIds).not.toContain(MAP_LAYERS.userAccuracy);
    expect(map.sources.has(MAP_SOURCES.userAccuracy)).toBe(false);
    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.addSource).toHaveBeenCalledWith(
      MAP_SOURCES.userLocation,
      expect.anything(),
    );
  });

  it("keeps the blue-dot pixel size independent of coords.accuracy", () => {
    const map = createMap();
    syncUserLocationDot(map as never, SEEKER_USER_LOCATION_IDS, {
      latitude: 32.08,
      longitude: 34.78,
      accuracy: 12,
    });
    syncUserLocationDot(map as never, SEEKER_USER_LOCATION_IDS, {
      latitude: 32.081,
      longitude: 34.781,
      accuracy: 400,
    });

    const paintCalls = map.addLayer.mock.calls.map(
      (call) => (call[0] as { paint?: Record<string, unknown> }).paint?.["circle-radius"],
    );
    expect(paintCalls).toEqual([USER_LOCATION_DOT_RADIUS_PX]);
    expect(map.project).not.toHaveBeenCalled();
  });

  it("does not create a large map overlay when GPS accuracy is poor", () => {
    const map = createMap();
    syncUserLocationDot(map as never, SEEKER_USER_LOCATION_IDS, {
      latitude: 32.08,
      longitude: 34.78,
      accuracy: 800,
    });

    for (const [, source] of map.sources) {
      for (const [data] of source.setData.mock.calls) {
        const features = (data as { features?: Array<{ properties?: Record<string, unknown> }> })
          .features ?? [];
        for (const feature of features) {
          expect(feature.properties?.radiusPx).toBeUndefined();
        }
      }
    }
  });

  it("Find Parking and Share a Spot share the same puck IDs", () => {
    expect(PICKER_USER_LOCATION_IDS.dotSource).toBe(
      SEEKER_USER_LOCATION_IDS.dotSource,
    );
    expect(PICKER_USER_LOCATION_IDS.dotLayer).toBe(
      SEEKER_USER_LOCATION_IDS.dotLayer,
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
