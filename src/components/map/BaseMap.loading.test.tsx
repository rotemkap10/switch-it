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
    isMoving: vi.fn(() => false),
    isEasing: vi.fn(() => false),
    getStyle: vi.fn(() => ({})),
    getSprite: vi.fn(() => []),
    getContainer: vi.fn(() => {
      if (!mapInstance.__container) {
        mapInstance.__container = document.createElement("div");
      }
      return mapInstance.__container;
    }),
    off: vi.fn((event: string, handler: Handler) => {
      const list = onHandlers.get(event) ?? [];
      onHandlers.set(
        event,
        list.filter((item) => item !== handler),
      );
    }),
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
    __container: undefined as HTMLElement | undefined,
    __reset() {
      onceHandlers.clear();
      onHandlers.clear();
      mapInstance.__container = undefined;
      mapInstance.once.mockClear();
      mapInstance.on.mockClear();
      mapInstance.off.mockClear();
      mapInstance.getContainer.mockClear();
      mapInstance.remove.mockClear();
      mapInstance.resize.mockClear();
      mapInstance.isMoving.mockClear();
      mapInstance.isMoving.mockReturnValue(false);
      mapInstance.isEasing.mockClear();
      mapInstance.isEasing.mockReturnValue(false);
    },
  };

  const MapMock = vi.fn(function MapMock(options?: { container?: HTMLElement }) {
    mapInstance.__container = options?.container ?? document.createElement("div");
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
        dragPan: {
          linearity: 0.3,
          deceleration: 2500,
          maxSpeed: 1400,
        },
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

  it("defers resize until moveend while the camera is moving", () => {
    let resizeCallback: (() => void) | null = null;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          resizeCallback = cb;
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );

    render(
      <BaseMap
        styleUrl="https://example.test/style.json"
        center={[34.78, 32.08]}
        zoom={14}
        onMapReady={vi.fn()}
      />,
    );

    act(() => {
      mapInstance.__emitOnce("load");
    });
    mapInstance.resize.mockClear();
    mapInstance.once.mockClear();
    mapInstance.isMoving.mockReturnValue(true);

    expect(resizeCallback).toBeTypeOf("function");
    act(() => {
      resizeCallback?.();
    });

    expect(mapInstance.resize).not.toHaveBeenCalled();
    expect(mapInstance.once).toHaveBeenCalledWith(
      "moveend",
      expect.any(Function),
    );

    mapInstance.isMoving.mockReturnValue(false);
    mapInstance.isEasing.mockReturnValue(false);
    act(() => {
      mapInstance.__emitOnce("moveend");
    });
    expect(mapInstance.resize).toHaveBeenCalled();
  });

  it("also defers resize while isEasing even if isMoving is false", () => {
    let resizeCallback: (() => void) | null = null;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          resizeCallback = cb;
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );

    render(
      <BaseMap
        styleUrl="https://example.test/style.json"
        center={[34.78, 32.08]}
        zoom={14}
        onMapReady={vi.fn()}
      />,
    );

    act(() => {
      mapInstance.__emitOnce("load");
    });
    mapInstance.resize.mockClear();
    mapInstance.once.mockClear();
    mapInstance.isMoving.mockReturnValue(false);
    mapInstance.isEasing.mockReturnValue(true);

    act(() => {
      resizeCallback?.();
    });

    expect(mapInstance.resize).not.toHaveBeenCalled();
    expect(mapInstance.once).toHaveBeenCalledWith(
      "moveend",
      expect.any(Function),
    );
  });

  it("constructs every map with compact native attribution", () => {
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
        attributionControl: { compact: true },
      }),
    );
    expect(MapMock.mock.calls[0]?.[0]).not.toMatchObject({
      attributionControl: false,
    });
  });

  it("collapses MapLibre compact attribution after it first appears", () => {
    render(
      <BaseMap
        styleUrl="https://example.test/style.json"
        center={[34.78, 32.08]}
        zoom={14}
        onMapReady={vi.fn()}
      />,
    );

    const container = mapInstance.getContainer();
    container.innerHTML = `
      <details class="maplibregl-ctrl maplibregl-ctrl-attrib maplibregl-compact maplibregl-compact-show">
        <summary class="maplibregl-ctrl-attrib-button" aria-label="Toggle attribution"></summary>
        <div class="maplibregl-ctrl-attrib-inner">© MapTiler © OpenStreetMap contributors</div>
      </details>
    `;

    act(() => {
      mapInstance.__emitOn("styledata");
    });

    const attrib = container.querySelector(".maplibregl-ctrl-attrib");
    expect(attrib).toBeInstanceOf(HTMLElement);
    expect(attrib).toHaveClass("maplibregl-compact");
    expect(attrib).not.toHaveClass("maplibregl-compact-show");
    expect(container.querySelector(".maplibregl-ctrl-attrib-inner")).toHaveTextContent(
      "© MapTiler © OpenStreetMap contributors",
    );
    expect(
      container.querySelector(".maplibregl-ctrl-attrib-button"),
    ).toHaveAttribute("aria-label", "Toggle attribution");
  });
});
