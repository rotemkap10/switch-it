import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (...args: unknown[]) => void;

const {
  mapInstance,
  MapMock,
  configureWorkerMock,
  configureRtlMock,
} = vi.hoisted(() => {
  const onceHandlers = new Map<string, Handler>();
  const onHandlers = new Map<string, Handler[]>();

  const mapInstance = {
    once: vi.fn((event: string, handler: Handler) => {
      onceHandlers.set(event, handler);
    }),
    on: vi.fn((event: string, handler: Handler) => {
      const list = onHandlers.get(event) ?? [];
      list.push(handler);
      onHandlers.set(event, list);
    }),
    remove: vi.fn(),
    resize: vi.fn(),
    getStyle: vi.fn(() => ({})),
    getSprite: vi.fn(() => []),
    __emitOnce(event: string) {
      const handler = onceHandlers.get(event);
      onceHandlers.delete(event);
      handler?.();
    },
    __emitOn(event: string, payload?: unknown) {
      for (const handler of onHandlers.get(event) ?? []) {
        handler(payload);
      }
    },
    __reset() {
      onceHandlers.clear();
      onHandlers.clear();
      mapInstance.once.mockClear();
      mapInstance.on.mockClear();
      mapInstance.remove.mockClear();
      mapInstance.resize.mockClear();
    },
  };

  const MapMock = vi.fn(function MapMock() {
    return mapInstance;
  });

  return {
    mapInstance,
    MapMock,
    configureWorkerMock: vi.fn(),
    configureRtlMock: vi.fn(),
  };
});

vi.mock("maplibre-gl", () => ({
  Map: MapMock,
}));

vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

vi.mock("@/lib/map/configure-maplibre-worker", () => ({
  configureMapLibreWorker: configureWorkerMock,
}));

vi.mock("@/lib/map/configure-maplibre-rtl", () => ({
  configureMapLibreRtlPlugin: configureRtlMock,
}));

vi.mock("@/lib/map/maptiler-transform-request", () => ({
  createMapTilerTransformRequest: () => undefined,
  sanitizeMapTilerUrl: () => ({ host: "", path: "", hasKeyParam: false }),
}));

vi.mock("@/lib/map/seekerMapConfig", () => ({
  MAP_MAX_ZOOM: 18,
  MAP_MIN_ZOOM: 7,
  MAP_SUPPORTED_MAX_BOUNDS: [
    [33.95, 29.35],
    [36.15, 33.5],
  ],
  getMapTilerApiKey: () => "test-key",
}));

import { BaseMap } from "@/components/map/BaseMap";

describe("BaseMap loading lifecycle", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = "test-key";
    mapInstance.__reset();
    MapMock.mockClear();
    vi.useRealTimers();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the branded loader before the map is visually ready", async () => {
    // Keep rAF from immediately completing readiness during this assertion.
    vi.stubGlobal("requestAnimationFrame", () => 0);

    render(
      <BaseMap
        styleUrl="https://example.test/style.json"
        center={[34.78, 32.08]}
        zoom={14}
        onMapReady={vi.fn()}
      />,
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Loading the map…",
    );
    expect(MapMock).toHaveBeenCalledTimes(1);
  });

  it("becomes usable after load + first paint without waiting for idle", async () => {
    const onMapReady = vi.fn();
    const onVisuallyReady = vi.fn();

    render(
      <BaseMap
        styleUrl="https://example.test/style.json"
        center={[34.78, 32.08]}
        zoom={14}
        onMapReady={onMapReady}
        onVisuallyReady={onVisuallyReady}
      />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      mapInstance.__emitOnce("load");
    });
    expect(onMapReady).toHaveBeenCalledTimes(1);
    // Sync rAF stub from beforeEach advances the paint path immediately.
    expect(onVisuallyReady).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("does not recreate the map when center props change", () => {
    const { rerender } = render(
      <BaseMap
        styleUrl="https://example.test/style.json"
        center={[34.78, 32.08]}
        zoom={14}
        onMapReady={vi.fn()}
      />,
    );

    expect(MapMock).toHaveBeenCalledTimes(1);

    rerender(
      <BaseMap
        styleUrl="https://example.test/style.json"
        center={[34.9, 32.2]}
        zoom={16}
        onMapReady={vi.fn()}
      />,
    );

    expect(MapMock).toHaveBeenCalledTimes(1);
    expect(mapInstance.remove).not.toHaveBeenCalled();
  });

  it("constructs with pitch/rotate constraints for parking UX", () => {
    render(
      <BaseMap
        styleUrl="https://example.test/style.json"
        center={[34.78, 32.08]}
        zoom={14}
        onMapReady={vi.fn()}
      />,
    );

    expect(MapMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dragRotate: false,
        touchPitch: false,
        pitchWithRotate: false,
        maxPitch: 0,
      }),
    );
  });

  it("replaces the loading path with unavailable when init fails before load", async () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const onMapUnavailable = vi.fn();

    render(
      <BaseMap
        styleUrl="https://example.test/style.json"
        center={[34.78, 32.08]}
        zoom={14}
        onMapReady={vi.fn()}
        onMapUnavailable={onMapUnavailable}
      />,
    );

    act(() => {
      mapInstance.__emitOn("error", {
        error: new Error("Failed to fetch style"),
      });
    });

    expect(onMapUnavailable).toHaveBeenCalledTimes(1);
  });

  it("does not destroy the map for military_label mismatch before style load", () => {
    const onMapUnavailable = vi.fn();

    render(
      <BaseMap
        styleUrl="https://example.test/style.json"
        center={[34.78, 32.08]}
        zoom={14}
        onMapReady={vi.fn()}
        onMapUnavailable={onMapUnavailable}
      />,
    );

    act(() => {
      mapInstance.__emitOn("error", {
        error: new Error(
          'Source layer "military_label" does not exist on source "maptiler_planet_v4" as specified by style layer "Military label".',
        ),
      });
    });

    expect(onMapUnavailable).not.toHaveBeenCalled();
  });

  it("does not escalate tile/image errors after style load", async () => {
    const onMapUnavailable = vi.fn();

    render(
      <BaseMap
        styleUrl="https://example.test/style.json"
        center={[34.78, 32.08]}
        zoom={14}
        onMapReady={vi.fn()}
        onMapUnavailable={onMapUnavailable}
      />,
    );

    act(() => {
      mapInstance.__emitOnce("load");
    });
    act(() => {
      mapInstance.__emitOn("error", {
        error: new Error('Image "road_shield" could not be loaded'),
      });
    });
    act(() => {
      mapInstance.__emitOn("error", {
        error: new Error("Failed to fetch style"),
      });
    });

    expect(onMapUnavailable).not.toHaveBeenCalled();
  });
});
