import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PARKING_MAP_BASEMAP_CLASS,
  ParkingMapMapLibre,
} from "@/components/map/ParkingMapMapLibre";
import {
  MAP_ADDRESS_SEARCH_ZOOM,
  MAP_DEFAULT_ZOOM,
  MAP_LAYERS,
} from "@/lib/map/seekerMapConfig";

const mockBaseMapProps: {
  center?: unknown;
  zoom?: unknown;
  className?: unknown;
} = {};

let mockMap: {
  addSource: ReturnType<typeof vi.fn>;
  getSource: ReturnType<typeof vi.fn>;
  addLayer: ReturnType<typeof vi.fn>;
  getLayer: ReturnType<typeof vi.fn>;
  addImage: ReturnType<typeof vi.fn>;
  hasImage: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  once: ReturnType<typeof vi.fn>;
  easeTo: ReturnType<typeof vi.fn>;
  jumpTo: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  fitBounds: ReturnType<typeof vi.fn>;
  getZoom: ReturnType<typeof vi.fn>;
  getBearing: ReturnType<typeof vi.fn>;
  getPitch: ReturnType<typeof vi.fn>;
  getCanvas: ReturnType<typeof vi.fn>;
  getCenter: ReturnType<typeof vi.fn>;
  project: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  dragPan: { enable: ReturnType<typeof vi.fn>; disable: ReturnType<typeof vi.fn> };
  isMoving: ReturnType<typeof vi.fn>;
  isEasing: ReturnType<typeof vi.fn>;
};

const sharedListeners = new Set<
  (snap: {
    trustedFix: {
      latitude: number;
      longitude: number;
      accuracy: number | null;
      timestamp: number;
    } | null;
    status: string;
    error: string | null;
  }) => void
>();
let peekTrustedFix: {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
} | null = null;
const pendingTrustedWaiters: Array<
  (
    result:
      | {
          ok: true;
          fix: {
            latitude: number;
            longitude: number;
            accuracy: number | null;
            timestamp: number;
          };
        }
      | { ok: false; reason: string },
  ) => void
> = [];
const applyFreshFixMock = vi.fn();

vi.mock("@/lib/map/shared-foreground-location", () => ({
  acquireSharedForegroundLocation: () => vi.fn(),
  subscribeSharedForegroundLocation: (
    listener: (snap: {
      trustedFix: {
        latitude: number;
        longitude: number;
        accuracy: number | null;
        timestamp: number;
      } | null;
      status: string;
      error: string | null;
    }) => void,
  ) => {
    sharedListeners.add(listener);
    listener({
      trustedFix: peekTrustedFix,
      status: peekTrustedFix ? "ready" : "acquiring",
      error: null,
    });
    return () => {
      sharedListeners.delete(listener);
    };
  },
  peekTrustedSharedForegroundFix: () => peekTrustedFix,
  waitForTrustedSharedForegroundFix: vi.fn(
    async (
      _consumerId: string,
      options?: {
        afterFix?: {
          latitude: number;
          longitude: number;
          accuracy: number | null;
          timestamp: number;
        } | null;
      },
    ) => {
      const after = options?.afterFix ?? null;
      const isUsable = (fix: typeof peekTrustedFix) => {
        if (!fix) {
          return false;
        }
        if (!after) {
          return true;
        }
        return (
          fix.timestamp > after.timestamp ||
          Math.abs(fix.latitude - after.latitude) > 0.0001 ||
          Math.abs(fix.longitude - after.longitude) > 0.0001
        );
      };
      if (isUsable(peekTrustedFix)) {
        return { ok: true as const, fix: peekTrustedFix };
      }
      return await new Promise<
        | {
            ok: true;
            fix: {
              latitude: number;
              longitude: number;
              accuracy: number | null;
              timestamp: number;
            };
          }
        | { ok: false; reason: string }
      >((resolve) => {
        pendingTrustedWaiters.push(resolve);
      });
    },
  ),
}));

vi.mock("@/components/map/BaseMap", () => ({
  BaseMap: (props: {
    onMapReady: (map: unknown) => void;
    onVisuallyReady?: () => void;
    center: unknown;
    zoom: unknown;
    className?: string;
  }) => {
    mockBaseMapProps.center = props.center;
    mockBaseMapProps.zoom = props.zoom;
    mockBaseMapProps.className = props.className;
    useEffect(() => {
      props.onMapReady(mockMap);
      props.onVisuallyReady?.();
    }, [props]);
    return <div data-testid="base-map" className={props.className} />;
  },
}));

type LocationStatus =
  | "idle"
  | "loading"
  | "ready"
  | "denied"
  | "unavailable"
  | "timeout"
  | "unsupported";

let mockedStatus: LocationStatus = "denied";

vi.mock("@/lib/map/use-user-location", () => ({
  useUserLocation: () => {
    const [state, setState] = React.useState(() =>
      mockedStatus === "ready"
        ? {
            status: "ready" as const,
            latitude: 32.085312,
            longitude: 34.781812,
            accuracy: 10,
            timestamp: 1,
          }
        : { status: mockedStatus },
    );
    return {
      state,
      applyFreshFix: (fix: {
        latitude: number;
        longitude: number;
        accuracy: number | null;
        timestamp: number;
      }) => {
        applyFreshFixMock(fix);
        setState({
          status: "ready",
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracy: fix.accuracy,
          timestamp: fix.timestamp,
        });
      },
      applyError: vi.fn(),
    };
  },
}));

function emitSharedTrusted(fix: {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}) {
  peekTrustedFix = fix;
  const snap = {
    trustedFix: fix,
    status: "ready",
    error: null,
  };
  for (const listener of sharedListeners) {
    listener(snap);
  }
  const waiters = pendingTrustedWaiters.splice(0);
  for (const resolve of waiters) {
    resolve({ ok: true, fix });
  }
}

function handler(event: string) {
  return mockMap.on.mock.calls.find((call) => call[0] === event)?.[1] as
    | ((payload?: unknown) => void)
    | undefined;
}

describe("ParkingMapMapLibre picker mode", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = "test-key";
    const sources = new Map<string, { type: string; setData: ReturnType<typeof vi.fn> }>();
    const layers = new Set<string>();
    const images = new Set<string>();
    mockMap = {
      addSource: vi.fn((id: string) => {
        sources.set(id, { type: "geojson", setData: vi.fn() });
      }),
      getSource: vi.fn((id: string) => sources.get(id)),
      addLayer: vi.fn((layer: { id: string }) => {
        layers.add(layer.id);
      }),
      getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
      addImage: vi.fn((id: string) => {
        images.add(id);
      }),
      hasImage: vi.fn((id: string) => images.has(id)),
      on: vi.fn(),
      once: vi.fn(),
      easeTo: vi.fn(),
      jumpTo: vi.fn(),
      stop: vi.fn(),
      fitBounds: vi.fn(),
      getZoom: vi.fn(() => MAP_DEFAULT_ZOOM),
      getBearing: vi.fn(() => 0),
      getPitch: vi.fn(() => 0),
      getCanvas: vi.fn(() => ({ style: {} })),
      getCenter: vi.fn(() => ({ lng: 34.7818, lat: 32.0853 })),
      project: vi.fn(() => ({ x: 0, y: 0 })),
      remove: vi.fn(),
      dragPan: { enable: vi.fn(), disable: vi.fn() },
      isMoving: vi.fn(() => false),
      isEasing: vi.fn(() => false),
    };
    mockedStatus = "denied";
    applyFreshFixMock.mockReset();
    sharedListeners.clear();
    peekTrustedFix = {
      latitude: 32.0853,
      longitude: 34.7818,
      accuracy: 10,
      timestamp: Date.now(),
    };
    pendingTrustedWaiters.length = 0;
    mockBaseMapProps.center = undefined;
    mockBaseMapProps.zoom = undefined;
    mockBaseMapProps.className = undefined;
  });

  it("uses the same BaseMap surface and initial zoom as Find Parking", async () => {
    const { unmount } = render(
      <ParkingMapMapLibre mode="browse" spots={[]} destination={null} />,
    );
    await waitFor(() => expect(mockMap.on).toHaveBeenCalled());
    const browseZoom = mockBaseMapProps.zoom;
    const browseClass = mockBaseMapProps.className;
    expect(browseZoom).toBe(MAP_DEFAULT_ZOOM);
    expect(browseClass).toBe(PARKING_MAP_BASEMAP_CLASS);
    unmount();

    render(
      <ParkingMapMapLibre
        mode="picker"
        spots={[]}
        destination={null}
        showDiscoveryCarousel={false}
      />,
    );
    await waitFor(() => expect(screen.getByTestId("parking-map-stage")).toHaveAttribute(
      "data-map-mode",
      "picker",
    ));
    expect(mockBaseMapProps.zoom).toBe(browseZoom);
    expect(mockBaseMapProps.className).toBe(browseClass);
    expect(mockBaseMapProps.zoom).toBe(14);
  });

  it("does not call dragPan.enable or disable", async () => {
    render(
      <ParkingMapMapLibre
        mode="picker"
        spots={[]}
        showDiscoveryCarousel={false}
      />,
    );
    await waitFor(() => expect(mockMap.on).toHaveBeenCalled());
    expect(mockMap.dragPan.enable).not.toHaveBeenCalled();
    expect(mockMap.dragPan.disable).not.toHaveBeenCalled();
  });

  it("registers the same core gesture listeners as browse, plus observe-only moveend", async () => {
    render(
      <ParkingMapMapLibre
        mode="picker"
        spots={[]}
        showDiscoveryCarousel={false}
      />,
    );
    await waitFor(() => expect(mockMap.on).toHaveBeenCalled());
    const events = mockMap.on.mock.calls.map((call) => call[0]);
    expect(events).toContain("dragstart");
    expect(events).toContain("zoomstart");
    expect(events).toContain("moveend");
    expect(events).toContain("click");
    expect(events).not.toContain("movestart");
    expect(events).not.toContain("drag");
    expect(events).not.toContain("dragend");
    expect(events).not.toContain("move");
    expect(events).not.toContain("touchstart");
  });

  it("commits map.getCenter() on user moveend without camera feedback", async () => {
    const onPickerLocationChange = vi.fn();
    const onPickerUserMovedMap = vi.fn();
    render(
      <ParkingMapMapLibre
        mode="picker"
        spots={[]}
        showDiscoveryCarousel={false}
        onPickerLocationChange={onPickerLocationChange}
        onPickerUserMovedMap={onPickerUserMovedMap}
      />,
    );
    await waitFor(() => expect(mockMap.on).toHaveBeenCalled());

    mockMap.jumpTo.mockClear();
    mockMap.easeTo.mockClear();
    mockMap.getCenter.mockReturnValue({ lat: 32.1, lng: 34.8 });

    handler("dragstart")?.({ originalEvent: { type: "pointerdown" } });
    handler("moveend")?.();

    expect(onPickerUserMovedMap).toHaveBeenCalledTimes(1);
    expect(onPickerLocationChange).toHaveBeenCalledWith(32.1, 34.8);
    expect(mockMap.jumpTo).not.toHaveBeenCalled();
    expect(mockMap.easeTo).not.toHaveBeenCalled();
    expect(await screen.findByText("Location selected")).toBeInTheDocument();
  });

  it("does not treat a map-originated commit as an external camera command", async () => {
    const onPickerLocationChange = vi.fn();
    const { rerender } = render(
      <ParkingMapMapLibre
        mode="picker"
        spots={[]}
        showDiscoveryCarousel={false}
        onPickerLocationChange={onPickerLocationChange}
      />,
    );
    await waitFor(() => expect(mockMap.on).toHaveBeenCalled());

    mockMap.getCenter.mockReturnValue({ lat: 32.11, lng: 34.81 });
    handler("dragstart")?.({ originalEvent: { type: "touchstart" } });
    handler("moveend")?.();
    expect(onPickerLocationChange).toHaveBeenCalledWith(32.11, 34.81);

    mockMap.jumpTo.mockClear();
    mockMap.easeTo.mockClear();
    rerender(
      <ParkingMapMapLibre
        mode="picker"
        spots={[]}
        showDiscoveryCarousel={false}
        onPickerLocationChange={onPickerLocationChange}
      />,
    );
    expect(mockMap.jumpTo).not.toHaveBeenCalled();
    expect(mockMap.easeTo).not.toHaveBeenCalled();
  });

  it("Current Location intentionally moves the camera at the shared zoom", async () => {
    const user = userEvent.setup();
    const onRequested = vi.fn();
    const onResolved = vi.fn();
    const onLocationChange = vi.fn();
    render(
      <ParkingMapMapLibre
        mode="picker"
        spots={[]}
        showDiscoveryCarousel={false}
        onPickerCurrentLocationRequested={onRequested}
        onPickerCurrentLocationResolved={onResolved}
        onPickerLocationChange={onLocationChange}
      />,
    );
    await waitFor(() => expect(mockMap.on).toHaveBeenCalled());

    mockMap.easeTo.mockClear();
    await user.click(
      await screen.findByRole("button", { name: "Use my current location" }),
    );
    expect(onRequested).toHaveBeenCalledTimes(1);

    emitSharedTrusted({
      latitude: 32.085312,
      longitude: 34.781812,
      accuracy: 8,
      timestamp: Date.now(),
    });

    await waitFor(() => {
      expect(mockMap.easeTo).toHaveBeenCalledWith(
        expect.objectContaining({
          center: [34.781812, 32.085312],
          zoom: MAP_DEFAULT_ZOOM,
        }),
      );
    });
    expect(onResolved).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 32.085312,
        longitude: 34.781812,
      }),
    );
    expect(mockMap.getZoom()).toBe(MAP_DEFAULT_ZOOM);
    expect(mockMap.getBearing()).toBe(0);
    expect(mockMap.getPitch()).toBe(0);

    mockMap.getCenter.mockReturnValue({ lat: 32.085312, lng: 34.781812 });
    handler("moveend")?.();
    expect(onLocationChange).toHaveBeenCalledWith(32.085312, 34.781812);
    expect(mockMap.jumpTo).not.toHaveBeenCalled();
  });

  it("address selection intentionally moves the camera", async () => {
    render(
      <ParkingMapMapLibre
        mode="picker"
        spots={[]}
        showDiscoveryCarousel={false}
        pickerExternalRecenter={{
          requestId: 1,
          latitude: 32.26,
          longitude: 34.89,
        }}
      />,
    );
    await waitFor(() => {
      expect(mockMap.easeTo).toHaveBeenCalledWith(
        expect.objectContaining({
          center: [34.89, 32.26],
          zoom: MAP_DEFAULT_ZOOM,
        }),
      );
    });
    expect(mockMap.jumpTo).not.toHaveBeenCalled();
  });

  it("zooms to street/building level for a precise address selection", async () => {
    render(
      <ParkingMapMapLibre
        mode="picker"
        spots={[]}
        showDiscoveryCarousel={false}
        pickerExternalRecenter={{
          requestId: 2,
          latitude: 32.0853,
          longitude: 34.7818,
          zoom: MAP_ADDRESS_SEARCH_ZOOM,
        }}
      />,
    );
    await waitFor(() => {
      expect(mockMap.easeTo).toHaveBeenCalledWith(
        expect.objectContaining({
          center: [34.7818, 32.0853],
          zoom: MAP_ADDRESS_SEARCH_ZOOM,
        }),
      );
    });
    expect(MAP_ADDRESS_SEARCH_ZOOM).toBeGreaterThan(MAP_DEFAULT_ZOOM);
    expect(mockMap.jumpTo).not.toHaveBeenCalled();
  });

  it("does not re-apply address zoom after the user pans or zooms", async () => {
    const { rerender } = render(
      <ParkingMapMapLibre
        mode="picker"
        spots={[]}
        showDiscoveryCarousel={false}
        pickerExternalRecenter={{
          requestId: 4,
          latitude: 32.0853,
          longitude: 34.7818,
          zoom: MAP_ADDRESS_SEARCH_ZOOM,
        }}
      />,
    );
    await waitFor(() => expect(mockMap.easeTo).toHaveBeenCalled());
    mockMap.easeTo.mockClear();

    handler("dragstart")?.({ originalEvent: { type: "pointerdown" } });
    handler("zoomstart")?.({ originalEvent: { type: "wheel" } });

    rerender(
      <ParkingMapMapLibre
        mode="picker"
        spots={[]}
        showDiscoveryCarousel={false}
        pickerExternalRecenter={{
          requestId: 4,
          latitude: 32.0853,
          longitude: 34.7818,
          zoom: MAP_ADDRESS_SEARCH_ZOOM,
        }}
      />,
    );

    expect(mockMap.easeTo).not.toHaveBeenCalled();
  });

  it("lifts the center pin via DOM class on dragstart without a move listener", async () => {
    render(
      <ParkingMapMapLibre
        mode="picker"
        spots={[]}
        showDiscoveryCarousel={false}
      />,
    );
    await waitFor(() => expect(mockMap.on).toHaveBeenCalled());
    const pin = document.querySelector(".leaver-center-pin");
    expect(pin?.classList.contains("is-lifting")).toBe(false);
    handler("dragstart")?.({ originalEvent: { type: "pointerdown" } });
    expect(pin?.classList.contains("is-lifting")).toBe(true);
    handler("moveend")?.();
    expect(pin?.classList.contains("is-lifting")).toBe(false);
    expect(handler("move")).toBeUndefined();
  });

  it("initializes the same seeker symbol layer path as Find Parking", async () => {
    render(
      <ParkingMapMapLibre
        mode="picker"
        spots={[]}
        showDiscoveryCarousel={false}
      />,
    );
    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalledWith(
        expect.objectContaining({ id: MAP_LAYERS.spotsSymbols }),
      );
    });
  });
});
