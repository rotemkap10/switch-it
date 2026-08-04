import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
import { MAP_READY_FADE_MS } from "@/components/map/MapLoadingState";

describe("BaseMap loading lifecycle", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = "test-key";
    mapInstance.__reset();
    MapMock.mockClear();
    vi.useRealTimers();
  });

  it("shows the branded loader before the map is visually ready", async () => {
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

  it("hides the loader after load + idle", () => {
    vi.useFakeTimers();
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
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(onVisuallyReady).not.toHaveBeenCalled();

    act(() => {
      mapInstance.__emitOnce("idle");
    });
    expect(onVisuallyReady).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(MAP_READY_FADE_MS);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("replaces the loading path with unavailable when init fails before load", async () => {
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

    expect(onMapUnavailable).not.toHaveBeenCalled();
  });
});
