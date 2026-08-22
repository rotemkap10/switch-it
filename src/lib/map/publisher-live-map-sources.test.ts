import { describe, expect, it, vi } from "vitest";

import type { SeekerLocationPayload } from "@/lib/location/payload";
import {
  PUBLISHER_LIVE_SEEKER_SOURCE,
  applyPublisherSeekerLocation,
  asGeoJsonSource,
  ensurePublisherLiveMapSources,
  handoffLiveErrorMessage,
  logPublisherLiveMapUpdateFailure,
  publisherLiveMapLifecycle,
} from "@/lib/map/publisher-live-map-sources";

vi.mock("@/lib/map/seekerMarkerImages", () => ({
  SEEKER_MARKER_IMAGE_IDS: {
    destination: "spot-destination",
    seekerLive: "seeker-live",
  },
  registerSeekerMarkerImages: vi.fn(),
}));

const seekerLocation: SeekerLocationPayload = {
  latitude: 32.086,
  longitude: 34.782,
  accuracyMeters: 10,
  headingDegrees: null,
  sequence: 1,
  sentAt: Date.now(),
};

function createFakeMap(options?: {
  missingSeekerSource?: boolean;
  setDataThrows?: boolean;
}) {
  const sources = new Map<string, { type: string; setData: ReturnType<typeof vi.fn> }>();
  const layers = new Set<string>();
  const host = document.createElement("div");
  const canvas = document.createElement("canvas");
  host.appendChild(canvas);

  const addSource = vi.fn((id: string, spec: { type: string }) => {
    sources.set(id, {
      type: spec.type,
      setData: vi.fn(() => {
        if (options?.setDataThrows && id === PUBLISHER_LIVE_SEEKER_SOURCE) {
          throw new Error("Style is not done loading");
        }
      }),
    });
  });

  return {
    map: {
      resize: vi.fn(),
      getSource: vi.fn((id: string) => {
        if (options?.missingSeekerSource && id === PUBLISHER_LIVE_SEEKER_SOURCE) {
          return undefined;
        }
        return sources.get(id);
      }),
      addSource,
      addLayer: vi.fn((layer: { id: string }) => {
        layers.add(layer.id);
      }),
      getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
      hasImage: vi.fn(() => true),
      getCanvas: vi.fn(() => canvas),
      isStyleLoaded: vi.fn(() => true),
    },
    sources,
  };
}

describe("applyPublisherSeekerLocation", () => {
  it("creates sources and applies setData after map load", () => {
    const { map, sources } = createFakeMap();
    ensurePublisherLiveMapSources(map as never, 34.7818, 32.0853, null);

    const result = applyPublisherSeekerLocation(
      map as never,
      34.7818,
      32.0853,
      seekerLocation,
    );

    expect(result).toEqual({ ok: true });
    expect(sources.get(PUBLISHER_LIVE_SEEKER_SOURCE)?.setData).toHaveBeenCalled();
  });

  it("resolves the seeker source fresh on each update", () => {
    const { map, sources } = createFakeMap();
    ensurePublisherLiveMapSources(map as never, 34.7818, 32.0853, null);

    applyPublisherSeekerLocation(map as never, 34.7818, 32.0853, seekerLocation);
    applyPublisherSeekerLocation(map as never, 34.7818, 32.0853, {
      ...seekerLocation,
      latitude: 32.087,
      longitude: 34.783,
      sequence: 2,
    });

    const seekerSource = sources.get(PUBLISHER_LIVE_SEEKER_SOURCE);
    expect(seekerSource?.setData).toHaveBeenCalledTimes(2);
    const last = seekerSource?.setData.mock.calls.at(-1)?.[0] as {
      features: Array<{ geometry: { coordinates: [number, number] } }>;
    };
    expect(last.features[0]?.geometry.coordinates).toEqual([34.783, 32.087]);
  });

  it("returns source_unavailable without throwing when the seeker source is missing", () => {
    const { map } = createFakeMap({ missingSeekerSource: true });
    const result = applyPublisherSeekerLocation(
      map as never,
      34.7818,
      32.0853,
      seekerLocation,
    );
    expect(result).toEqual({ ok: false, reason: "source_unavailable" });
  });

  it("returns set_data_failed when setData throws", () => {
    const { map } = createFakeMap({ setDataThrows: true });
    ensurePublisherLiveMapSources(map as never, 34.7818, 32.0853, null);

    const result = applyPublisherSeekerLocation(
      map as never,
      34.7818,
      32.0853,
      seekerLocation,
    );
    expect(result).toEqual({ ok: false, reason: "set_data_failed" });
  });
});

describe("asGeoJsonSource", () => {
  it("returns null for non-geojson sources", () => {
    const map = {
      getSource: vi.fn(() => ({ type: "vector" })),
    };
    expect(asGeoJsonSource(map as never, "x")).toBeNull();
  });
});

describe("publisherLiveMapLifecycle", () => {
  it("reports seeker source readiness", () => {
    const { map } = createFakeMap();
    ensurePublisherLiveMapSources(map as never, 34.7818, 32.0853, null);
    expect(publisherLiveMapLifecycle(map as never)).toMatchObject({
      mapLoaded: true,
      styleLoaded: true,
      seekerSourceExists: true,
      seekerSourceReady: true,
    });
  });
});

describe("logPublisherLiveMapUpdateFailure", () => {
  it("logs flat primitive diagnostics for Capacitor Logcat", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logPublisherLiveMapUpdateFailure(new Error("Style is not done loading"), {
      mapLoaded: true,
      mapRemoved: false,
      styleLoaded: true,
      seekerSourceExists: true,
      seekerSourceReady: false,
      claimId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching(/publisher live map update failed/),
    );
    expect(spy.mock.calls[0]?.[0]).toContain("errorMessage=Style is not done loading");
    expect(spy.mock.calls[0]?.[0]).toContain("sourceReady=false");
    expect(spy.mock.calls[0]?.[0]).not.toContain("[object Object]");
    spy.mockRestore();
  });
});

describe("handoffLiveErrorMessage", () => {
  it("extracts message from Error-like objects", () => {
    expect(handoffLiveErrorMessage(new Error("boom"))).toBe("boom");
    expect(handoffLiveErrorMessage({ message: "wrapped" })).toBe("wrapped");
  });
});
