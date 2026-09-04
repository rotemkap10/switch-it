import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MapSpot } from "@/types/map-spot";
import {
  MAP_LAYERS,
  MAP_SOURCES,
  MAP_DEFAULT_CENTER_TEL_AVIV,
  MAP_SELECTED_SPOT_ZOOM,
} from "@/lib/map/seekerMapConfig";
import {
  resetSessionMapCameras,
  writeSessionMapCamera,
} from "@/lib/map/session-camera";

const spot: MapSpot = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  latitude: 32.167,
  longitude: 34.843,
  address: null,
  available_at: new Date(Date.now() + 60_000).toISOString(),
  expires_at: new Date(Date.now() + 600_000).toISOString(),
  canClaim: true,
};

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
  stop: ReturnType<typeof vi.fn>;
  fitBounds: ReturnType<typeof vi.fn>;
  getZoom: ReturnType<typeof vi.fn>;
  getCanvas: ReturnType<typeof vi.fn>;
  getCenter: ReturnType<typeof vi.fn>;
  project: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

const mockBaseMapProps: {
  center?: unknown;
  zoom?: unknown;
  className?: unknown;
} = {};

let deferMapReady = false;
let flushDeferredMapReady: (() => void) | null = null;

const applyFreshFixMock = vi.fn();
const applyErrorMock = vi.fn();
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
const releaseSharedMock = vi.fn();
const stopExplicitRefMock = vi.fn();

vi.mock("@/lib/map/shared-foreground-location", () => ({
  acquireSharedForegroundLocation: () => releaseSharedMock,
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
        return { ok: true as const, fix: peekTrustedFix! };
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

vi.mock("@/lib/map/watch-best-device-location", () => ({
  watchBestDeviceLocation: () => stopExplicitRefMock,
}));

vi.mock("@/components/map/BaseMap", () => {
  return {
    BaseMap: (props: {
      onMapReady: (map: unknown) => void;
      onVisuallyReady?: () => void;
      styleUrl: string;
    center: unknown;
    zoom: unknown;
    className?: string;
  }) => {
    mockBaseMapProps.center = props.center;
    mockBaseMapProps.zoom = props.zoom;
    mockBaseMapProps.className = props.className;

      useEffect(() => {
        if (deferMapReady) {
          flushDeferredMapReady = () => {
            props.onMapReady(mockMap);
          };
          props.onVisuallyReady?.();
          return;
        }
        props.onMapReady(mockMap);
        props.onVisuallyReady?.();
      }, [props]);

      return <div data-testid="base-map" />;
    },
  };
});

type LocationStatus =
  | "idle"
  | "loading"
  | "ready"
  | "denied"
  | "unavailable"
  | "timeout"
  | "unsupported";

let mockedStatus: LocationStatus = "denied";
const mockedReadyFix = {
  latitude: 32.085312,
  longitude: 34.781812,
  accuracy: 10,
  timestamp: 1,
};

vi.mock("@/lib/map/use-user-location", () => {
  return {
    useUserLocation: () => {
      const [state, setState] = React.useState(() =>
        mockedStatus === "ready"
          ? { status: "ready" as const, ...mockedReadyFix }
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
        applyError: (reason: LocationStatus) => {
          applyErrorMock(reason);
          setState({ status: reason });
        },
      };
    },
  };
});

import { ParkingMapMapLibre } from "@/components/map/ParkingMapMapLibre";

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

function emitSharedError(reason: string) {
  const snap = {
    trustedFix: null,
    status: "error",
    error: reason,
  };
  for (const listener of sharedListeners) {
    listener(snap);
  }
  const waiters = pendingTrustedWaiters.splice(0);
  for (const resolve of waiters) {
    resolve({ ok: false, reason });
  }
}

describe("ParkingMapMapLibre geolocation", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = "test-key";
    resetSessionMapCameras();

    const sources = new Map<string, { type: string; setData: (d: unknown) => void }>();
    const layers = new Set<string>();
    const images = new Set<string>();

    mockMap = {
      addSource: vi.fn((id: string) => {
        sources.set(id, {
          type: "geojson",
          setData: vi.fn(),
        });
      }),
      getSource: vi.fn((id: string) => {
        return sources.get(id);
      }),
      addLayer: vi.fn((layer: { id: string }) => {
        layers.add(layer.id);
      }),
      getLayer: vi.fn((id: string) => {
        return layers.has(id) ? { id } : undefined;
      }),
      addImage: vi.fn((id: string) => {
        images.add(id);
      }),
      hasImage: vi.fn((id: string) => images.has(id)),
      on: vi.fn(),
      once: vi.fn(),
      easeTo: vi.fn(),
      stop: vi.fn(),
      fitBounds: vi.fn(),
      getZoom: vi.fn(() => 14),
      getCanvas: vi.fn(() => ({ style: {} })),
      getCenter: vi.fn(() => ({ lng: 34.7818, lat: 32.0853 })),
      project: vi.fn(() => ({ x: 0, y: 0 })),
      remove: vi.fn(),
    };

    mockedStatus = "denied";
    applyFreshFixMock.mockReset();
    applyErrorMock.mockReset();
    sharedListeners.clear();
    peekTrustedFix = null;
    pendingTrustedWaiters.length = 0;
    releaseSharedMock.mockReset();
    stopExplicitRefMock.mockReset();
    mockBaseMapProps.center = undefined;
    mockBaseMapProps.zoom = undefined;
    mockBaseMapProps.className = undefined;
    deferMapReady = false;
    flushDeferredMapReady = null;
  });

  const destination = { latitude: 32.168, longitude: 34.844 };

  it.each([
    ["denied", "denied"],
    ["unavailable", "unavailable"],
    ["timeout", "timeout"],
    ["unsupported", "unsupported"],
  ] as const)(
    "renders the map when geolocation status is %s and omits user-location layers",
    async (_label, status) => {
      mockedStatus = status;

      render(<ParkingMapMapLibre spots={[spot]} destination={destination} />);

      expect(await screen.findByTestId("base-map")).toBeInTheDocument();
      expect(screen.queryByText(/Map is unavailable/i)).not.toBeInTheDocument();

      const banner = await screen.findByTestId("location-unavailable-pill");
      expect(banner).toHaveTextContent("Location unavailable");
      expect(banner).toHaveTextContent("You can still browse the map.");
      expect(banner.className).toContain("rounded-full");
      expect(
        screen.queryByText(
          "Location unavailable — you can still browse parking spots.",
        ),
      ).not.toBeInTheDocument();

      await waitFor(() => {
        expect(mockMap.hasImage).toHaveBeenCalledWith("spot-unselected");
        expect(mockMap.hasImage).toHaveBeenCalledWith("spot-selected");
        expect(mockMap.hasImage).toHaveBeenCalledWith("spot-destination");

        expect(mockMap.addLayer).toHaveBeenCalledWith(
          expect.objectContaining({ id: MAP_LAYERS.spotsSymbols }),
        );
        expect(mockMap.addLayer).toHaveBeenCalledWith(
          expect.objectContaining({
            id: MAP_LAYERS.destination,
            layout: expect.objectContaining({
              "icon-image": "spot-destination",
            }),
          }),
        );

        const spotsLayerCall = mockMap.addLayer.mock.calls.find((call) => {
          const arg = call[0] as { id?: string };
          return arg?.id === MAP_LAYERS.spotsSymbols;
        });
        expect(spotsLayerCall?.[0]).toEqual(
          expect.objectContaining({
            layout: expect.objectContaining({
              "icon-image": [
                "case",
                ["boolean", ["get", "selected"], false],
                "spot-selected",
                "spot-unselected",
              ],
            }),
          }),
        );

        const layerIds = mockMap.addLayer.mock.calls.map((call) => {
          const firstArg = call[0] as { id?: string } | undefined;
          return firstArg?.id;
        });
        expect(layerIds).not.toContain(MAP_LAYERS.userDot);
        expect(layerIds).not.toContain(MAP_LAYERS.userAccuracy);

        const sourceIds = mockMap.addSource.mock.calls.map((call) => call[0]);
        expect(sourceIds).not.toContain(MAP_SOURCES.userLocation);
        expect(sourceIds).not.toContain(MAP_SOURCES.userAccuracy);
      });
    },
  );

  it("does not add destination layer without valid destination coordinates", async () => {
    mockedStatus = "denied";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);
    expect(screen.getByTestId("map-initial-location-loading")).toBeInTheDocument();
    emitSharedError("denied");

    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalledWith(
        expect.objectContaining({ id: MAP_LAYERS.spotsSymbols }),
      );
    });

    const layerIds = mockMap.addLayer.mock.calls.map((call) => {
      const firstArg = call[0] as { id?: string } | undefined;
      return firstArg?.id;
    });
    expect(layerIds).not.toContain(MAP_LAYERS.destination);
  });

  it("shows current-location control even when geolocation is unavailable", async () => {
    mockedStatus = "denied";
    render(<ParkingMapMapLibre spots={[spot]} destination={destination} />);

    expect(
      await screen.findByRole("button", { name: "Center on my location" }),
    ).toBeInTheDocument();
  });

  it("recenters the existing map on a fresh fix without recreating the map", async () => {
    mockedStatus = "loading";
    const user = userEvent.setup();

    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);
    expect(screen.getByTestId("map-initial-location-loading")).toBeInTheDocument();
    emitSharedError("timeout");

    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalled();
    });

    await user.click(
      await screen.findByRole("button", { name: "Center on my location" }),
    );

    emitSharedTrusted({
      latitude: 32.08,
      longitude: 34.78,
      accuracy: 10,
      timestamp: Date.now(),
    });

    await waitFor(() => {
      expect(applyFreshFixMock).toHaveBeenCalledWith(
        expect.objectContaining({ latitude: 32.08, longitude: 34.78 }),
      );
      expect(mockMap.stop).toHaveBeenCalled();
      expect(mockMap.easeTo).toHaveBeenCalledWith(
        expect.objectContaining({
          center: [34.78, 32.08],
        }),
      );
    });
    expect(screen.getByTestId("base-map")).toBeInTheDocument();
  });

  it("shows friendly feedback when recenter geolocation fails", async () => {
    mockedStatus = "denied";
    const user = userEvent.setup();
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);
    emitSharedError("denied");

    await waitFor(() => {
      expect(screen.getByTestId("base-map")).toBeInTheDocument();
    });

    await user.click(
      await screen.findByRole("button", { name: "Center on my location" }),
    );

    emitSharedError("timeout");

    expect(
      await screen.findByTestId("current-location-unavailable-notice"),
    ).toHaveTextContent("Current location is unavailable.");
    expect(screen.getByTestId("base-map")).toBeInTheDocument();
  });

  function latestMapHandler(event: string) {
    const calls = mockMap.on.mock.calls.filter((call) => call[0] === event);
    const last = calls.at(-1);
    return last?.[last.length - 1] as ((event?: unknown) => void) | undefined;
  }

  function deviceFix(
    latitude = 32.085312,
    longitude = 34.781812,
  ) {
    return {
      latitude,
      longitude,
      accuracy: 10,
      timestamp: Date.now(),
    };
  }

  it("centers the map on a successful device geolocation fix", async () => {
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);
    expect(screen.getByTestId("map-initial-location-loading")).toBeInTheDocument();

    emitSharedTrusted(deviceFix());

    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalled();
    });

    expect(applyFreshFixMock).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 32.085312, longitude: 34.781812 }),
    );
    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [34.781812, 32.085312],
      }),
    );
    expect(mockBaseMapProps.center).toEqual([34.781812, 32.085312]);
    expect(screen.getByTestId("base-map")).toBeInTheDocument();
  });

  it("shows the current-location dot on the initial GPS fix without clicking Current Location", async () => {
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);
    emitSharedTrusted(deviceFix());

    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalled();
    });

    await waitFor(() => {
      const layerIds = mockMap.addLayer.mock.calls.map((call) => {
        const firstArg = call[0] as { id?: string } | undefined;
        return firstArg?.id;
      });
      expect(layerIds).toContain(MAP_LAYERS.userDot);
      expect(layerIds).not.toContain(MAP_LAYERS.userAccuracy);
    });

    const dotSource = mockMap.getSource(MAP_SOURCES.userLocation) as {
      setData: ReturnType<typeof vi.fn>;
    };
    expect(dotSource.setData).toHaveBeenCalledWith(
      expect.objectContaining({
        features: [
          expect.objectContaining({
            geometry: {
              type: "Point",
              coordinates: [34.781812, 32.085312],
            },
          }),
        ],
      }),
    );
    expect(mockMap.getSource(MAP_SOURCES.userAccuracy)).toBeFalsy();
  });

  it("shows the current-location dot when GPS arrives before the map is ready", async () => {
    deferMapReady = true;
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);

    emitSharedTrusted(deviceFix());
    await waitFor(() => {
      expect(screen.getByTestId("base-map")).toBeInTheDocument();
    });
    expect(mockMap.addLayer).not.toHaveBeenCalled();

    flushDeferredMapReady?.();

    await waitFor(() => {
      const layerIds = mockMap.addLayer.mock.calls.map((call) => {
        const firstArg = call[0] as { id?: string } | undefined;
        return firstArg?.id;
      });
      expect(layerIds).toContain(MAP_LAYERS.userDot);
    });
    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [34.781812, 32.085312],
      }),
    );
  });

  it("keeps updating the current-location dot after a user pan without recentering", async () => {
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);
    emitSharedTrusted(deviceFix());

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalledWith("dragstart", expect.any(Function));
    });

    emitSharedTrusted(deviceFix());
    await waitFor(() => {
      expect(mockMap.getSource(MAP_SOURCES.userLocation)).toBeTruthy();
    });

    latestMapHandler("dragstart")?.({ originalEvent: { type: "pointerdown" } });
    mockMap.easeTo.mockClear();

    emitSharedTrusted(deviceFix(32.09, 34.8));

    expect(mockMap.easeTo).not.toHaveBeenCalled();
    const dotSource = mockMap.getSource(MAP_SOURCES.userLocation) as {
      setData: ReturnType<typeof vi.fn>;
    };
    await waitFor(() => {
      expect(dotSource.setData).toHaveBeenCalledWith(
        expect.objectContaining({
          features: [
            expect.objectContaining({
              geometry: {
                type: "Point",
                coordinates: [34.8, 32.09],
              },
            }),
          ],
        }),
      );
    });
  });

  it("centers after map ready when GPS arrives first", async () => {
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);

    emitSharedTrusted(deviceFix());

    await waitFor(() => {
      expect(mockMap.easeTo).toHaveBeenCalledWith(
        expect.objectContaining({
          center: [34.781812, 32.085312],
        }),
      );
    });
  });

  it("keeps the map usable when geolocation fails", async () => {
    mockedStatus = "denied";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);
    expect(screen.getByTestId("map-initial-location-loading")).toBeInTheDocument();
    emitSharedError("denied");

    await waitFor(() => {
      expect(screen.getByTestId("base-map")).toBeInTheDocument();
    });

    expect(applyErrorMock).toHaveBeenCalledWith("denied");
    expect(screen.getByTestId("base-map")).toBeInTheDocument();
    expect(screen.queryByText(/Map is unavailable/i)).not.toBeInTheDocument();
    expect(mockMap.easeTo).not.toHaveBeenCalled();
    expect(mockBaseMapProps.center).toEqual([
      MAP_DEFAULT_CENTER_TEL_AVIV.lng,
      MAP_DEFAULT_CENTER_TEL_AVIV.lat,
    ]);
  });

  it("does not let a later GPS update overwrite a user pan", async () => {
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);
    emitSharedTrusted(deviceFix(32.08, 34.78));

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalledWith("dragstart", expect.any(Function));
    });

    latestMapHandler("dragstart")?.({ originalEvent: { type: "pointerdown" } });
    mockMap.easeTo.mockClear();

    emitSharedTrusted(deviceFix());

    expect(applyFreshFixMock).toHaveBeenCalled();
    expect(mockMap.easeTo).not.toHaveBeenCalled();
  });

  it("does not let a stale GPS result override a later user interaction", async () => {
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);
    emitSharedTrusted(deviceFix(32.08, 34.78));

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalledWith("zoomstart", expect.any(Function));
    });

    latestMapHandler("zoomstart")?.({ originalEvent: { type: "wheel" } });
    mockMap.easeTo.mockClear();

    emitSharedTrusted(deviceFix(32.09, 34.80));

    expect(mockMap.easeTo).not.toHaveBeenCalled();
  });

  it("still auto-centers after a programmatic zoom that is not a user gesture", async () => {
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);
    emitSharedError("timeout");

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalledWith("zoomstart", expect.any(Function));
    });

    latestMapHandler("zoomstart")?.({});
    mockMap.easeTo.mockClear();

    emitSharedTrusted(deviceFix());

    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [34.781812, 32.085312],
      }),
    );
  });

  it("explicit current-location action recenters even after the user panned", async () => {
    mockedStatus = "loading";
    const user = userEvent.setup();
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);
    emitSharedTrusted(deviceFix(32.085312, 34.781812));

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalledWith("dragstart", expect.any(Function));
    });

    latestMapHandler("dragstart")?.({ originalEvent: { type: "pointerdown" } });
    mockMap.easeTo.mockClear();
    mockMap.stop.mockClear();

    await user.click(
      await screen.findByRole("button", { name: "Center on my location" }),
    );

    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [34.781812, 32.085312],
      }),
    );

    mockMap.easeTo.mockClear();
    emitSharedTrusted(deviceFix(32.08, 34.78));

    await waitFor(() => {
      expect(mockMap.easeTo).toHaveBeenCalledWith(
        expect.objectContaining({
          center: [34.78, 32.08],
        }),
      );
    });
  });

  it("explicit current-location recenters repeatedly after manual pans", async () => {
    mockedStatus = "loading";
    const user = userEvent.setup();
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);
    emitSharedTrusted(deviceFix(32.085, 34.782));

    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalled();
    });

    const button = await screen.findByRole("button", {
      name: "Center on my location",
    });

    latestMapHandler("dragstart")?.({ originalEvent: { type: "pointerdown" } });
    mockMap.easeTo.mockClear();
    await user.click(button);
    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [34.782, 32.085] }),
    );

    latestMapHandler("dragstart")?.({ originalEvent: { type: "pointerdown" } });
    mockMap.easeTo.mockClear();
    await user.click(button);
    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [34.782, 32.085] }),
    );
  });

  it("queues an explicit recenter until the map instance is ready", async () => {
    deferMapReady = true;
    mockedStatus = "loading";
    const user = userEvent.setup();
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);
    emitSharedError("timeout");

    await waitFor(() => {
      expect(screen.getByTestId("base-map")).toBeInTheDocument();
    });

    await user.click(
      await screen.findByRole("button", { name: "Center on my location" }),
    );
    expect(() => {
      emitSharedTrusted(deviceFix(32.1, 34.8));
    }).not.toThrow();
    expect(mockMap.easeTo).not.toHaveBeenCalled();

    flushDeferredMapReady?.();

    await waitFor(() => {
      expect(mockMap.easeTo).toHaveBeenCalledWith(
        expect.objectContaining({
          center: [34.8, 32.1],
        }),
      );
    });
    expect(screen.getByTestId("base-map")).toBeInTheDocument();
  });

  it("keeps the map usable when explicit recenter geolocation fails after a pan", async () => {
    mockedStatus = "loading";
    const user = userEvent.setup();
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);
    emitSharedTrusted(deviceFix(32.085, 34.782));

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalledWith("dragstart", expect.any(Function));
    });

    latestMapHandler("dragstart")?.({ originalEvent: { type: "pointerdown" } });
    mockMap.easeTo.mockClear();

    await user.click(
      await screen.findByRole("button", { name: "Center on my location" }),
    );
    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [34.782, 32.085] }),
    );

    emitSharedError("timeout");

    expect(screen.getByTestId("base-map")).toBeInTheDocument();
    expect(screen.queryByText(/Map is unavailable/i)).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("current-location-unavailable-notice"),
    ).not.toBeInTheDocument();
  });

  it("waits in a loading state instead of flashing a default city, then uses the fallback", async () => {
    writeSessionMapCamera("seeker", {
      center: [34.78, 32.08],
      zoom: 16,
    });
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);

    expect(screen.getByTestId("map-initial-location-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("base-map")).not.toBeInTheDocument();

    emitSharedError("timeout");

    await waitFor(() => {
      expect(screen.getByTestId("base-map")).toBeInTheDocument();
    });
    expect(mockBaseMapProps.center).toEqual([
      MAP_DEFAULT_CENTER_TEL_AVIV.lng,
      MAP_DEFAULT_CENTER_TEL_AVIV.lat,
    ]);
  });

  it("lets a late GPS fix recenter before the user interacts", async () => {
    writeSessionMapCamera("seeker", {
      center: [34.78, 32.08],
      zoom: 16,
    });
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);
    emitSharedError("timeout");

    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalled();
    });
    mockMap.easeTo.mockClear();

    emitSharedTrusted(deviceFix(32.26, 34.89));

    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [34.89, 32.26],
      }),
    );
  });

  it("lets a later GPS sample replace the first auto-center during initialization", async () => {
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);
    emitSharedTrusted(deviceFix(32.08, 34.78));

    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalled();
    });

    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [34.78, 32.08] }),
    );

    mockMap.easeTo.mockClear();
    emitSharedTrusted(deviceFix(32.26, 34.89));
    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [34.89, 32.26] }),
    );
  });

  it("does not recenter after the user has dragged, even when a fresher GPS arrives", async () => {
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);
    emitSharedTrusted(deviceFix(32.08, 34.78));

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalledWith("dragstart", expect.any(Function));
    });

    latestMapHandler("dragstart")?.({ originalEvent: { type: "pointerdown" } });
    mockMap.easeTo.mockClear();
    emitSharedTrusted(deviceFix(32.26, 34.89));
    expect(mockMap.easeTo).not.toHaveBeenCalled();
  });

  it("starts a new location watch when the screen is opened again", async () => {
    mockedStatus = "loading";
    const { unmount } = render(
      <ParkingMapMapLibre spots={[spot]} destination={null} />,
    );
    emitSharedTrusted(deviceFix(32.08, 34.78));

    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalled();
    });

    unmount();
    expect(releaseSharedMock).toHaveBeenCalled();

    mockMap.easeTo.mockClear();
    releaseSharedMock.mockClear();
    peekTrustedFix = deviceFix(32.26, 34.89);
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);

    await waitFor(() => {
      expect(screen.getByTestId("base-map")).toBeInTheDocument();
    });
    expect(mockBaseMapProps.center).toEqual([34.89, 32.26]);
  });

  it("mounts immediately on a trusted peek without using Sokolov/Herzliya coords", async () => {
    peekTrustedFix = deviceFix(32.26, 34.89);
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);

    expect(screen.getByTestId("base-map")).toBeInTheDocument();
    expect(mockBaseMapProps.center).toEqual([34.89, 32.26]);
    expect(mockBaseMapProps.center).not.toEqual([34.843, 32.167]);
  });

  it("keeps an active destination camera on the parking spot instead of fitting Israel-wide bounds", async () => {
    mockedStatus = "loading";
    peekTrustedFix = deviceFix(32.5, 35.0);
    render(
      <ParkingMapMapLibre spots={[spot]} destination={destination} />,
    );

    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalled();
    });

    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [destination.longitude, destination.latitude],
        zoom: MAP_SELECTED_SPOT_ZOOM,
      }),
    );
    expect(mockMap.fitBounds).not.toHaveBeenCalled();

    mockMap.easeTo.mockClear();
    emitSharedTrusted(deviceFix(32.8, 35.2));
    expect(mockMap.fitBounds).not.toHaveBeenCalled();
    expect(mockMap.easeTo).not.toHaveBeenCalled();
  });

  it("recenters on trusted GPS after the active destination is released", async () => {
    mockedStatus = "loading";
    const gps = deviceFix(32.26, 34.89);
    peekTrustedFix = gps;
    const { rerender } = render(
      <ParkingMapMapLibre spots={[spot]} destination={destination} />,
    );

    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalled();
    });
    emitSharedTrusted(gps);
    mockMap.easeTo.mockClear();
    mockMap.fitBounds.mockClear();

    rerender(<ParkingMapMapLibre spots={[spot]} destination={null} />);

    expect(mockMap.fitBounds).not.toHaveBeenCalled();
    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [34.89, 32.26],
      }),
    );
  });

  it("does not let a late GPS override a pan after the destination is cleared", async () => {
    mockedStatus = "loading";
    peekTrustedFix = deviceFix(32.08, 34.78);
    const { rerender } = render(
      <ParkingMapMapLibre spots={[spot]} destination={destination} />,
    );

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalledWith("dragstart", expect.any(Function));
    });
    emitSharedTrusted(deviceFix(32.08, 34.78));

    rerender(<ParkingMapMapLibre spots={[spot]} destination={null} />);
    latestMapHandler("dragstart")?.({ originalEvent: { type: "pointerdown" } });
    mockMap.easeTo.mockClear();

    emitSharedTrusted(deviceFix(32.26, 34.89));
    expect(mockMap.easeTo).not.toHaveBeenCalled();
    expect(mockMap.fitBounds).not.toHaveBeenCalled();
  });
});
