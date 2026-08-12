import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MapSpot } from "@/types/map-spot";
import {
  MAP_LAYERS,
  MAP_SOURCES,
  MAP_DEFAULT_CENTER_TEL_AVIV,
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
} = {};

let deferMapReady = false;
let flushDeferredMapReady: (() => void) | null = null;

const applyFreshFixMock = vi.fn();
const applyErrorMock = vi.fn();
let watchOnUpdate: ((fix: {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}) => void) | null = null;
let watchOnError: ((reason: string) => void) | null = null;
const stopWatchMock = vi.fn();

vi.mock("@/lib/map/watch-best-device-location", () => ({
  watchBestDeviceLocation: (options: {
    onUpdate: (fix: {
      latitude: number;
      longitude: number;
      accuracy: number | null;
      timestamp: number;
    }) => void;
    onError: (reason: string) => void;
    onSettled?: (fix: unknown) => void;
  }) => {
    watchOnUpdate = options.onUpdate;
    watchOnError = options.onError;
    return stopWatchMock;
  },
}));

vi.mock("@/components/map/BaseMap", () => {
  return {
    BaseMap: (props: {
      onMapReady: (map: unknown) => void;
      onVisuallyReady?: () => void;
      styleUrl: string;
      center: unknown;
      zoom: unknown;
    }) => {
      mockBaseMapProps.center = props.center;
      mockBaseMapProps.zoom = props.zoom;

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
      getCenter: vi.fn(() => ({ lng: 34.843, lat: 32.167 })),
      project: vi.fn(() => ({ x: 0, y: 0 })),
      remove: vi.fn(),
    };

    mockedStatus = "denied";
    applyFreshFixMock.mockReset();
    applyErrorMock.mockReset();
    watchOnUpdate = null;
    watchOnError = null;
    stopWatchMock.mockReset();
    mockBaseMapProps.center = undefined;
    mockBaseMapProps.zoom = undefined;
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

    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalled();
    });

    await user.click(
      await screen.findByRole("button", { name: "Center on my location" }),
    );

    watchOnUpdate?.({
      latitude: 32.08,
      longitude: 34.78,
      accuracy: 10,
      timestamp: Date.now(),
    });

    expect(applyFreshFixMock).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 32.08, longitude: 34.78 }),
    );
    expect(mockMap.stop).toHaveBeenCalled();
    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [34.78, 32.08],
      }),
    );
    expect(screen.getByTestId("base-map")).toBeInTheDocument();
  });

  it("shows friendly feedback when recenter geolocation fails", async () => {
    mockedStatus = "denied";
    const user = userEvent.setup();
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);

    await user.click(
      await screen.findByRole("button", { name: "Center on my location" }),
    );

    watchOnError?.("timeout");

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

    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalled();
    });

    watchOnUpdate?.(deviceFix());

    expect(applyFreshFixMock).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 32.085312, longitude: 34.781812 }),
    );
    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [34.781812, 32.085312],
      }),
    );
    expect(screen.getByTestId("base-map")).toBeInTheDocument();
  });

  it("shows the current-location dot on the initial GPS fix without clicking Current Location", async () => {
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);

    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalled();
    });

    watchOnUpdate?.(deviceFix());

    await waitFor(() => {
      const layerIds = mockMap.addLayer.mock.calls.map((call) => {
        const firstArg = call[0] as { id?: string } | undefined;
        return firstArg?.id;
      });
      expect(layerIds).toContain(MAP_LAYERS.userDot);
      expect(layerIds).toContain(MAP_LAYERS.userAccuracy);
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
  });

  it("shows the current-location dot when GPS arrives before the map is ready", async () => {
    deferMapReady = true;
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);

    watchOnUpdate?.(deviceFix());
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

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalledWith("dragstart", expect.any(Function));
    });

    watchOnUpdate?.(deviceFix());
    await waitFor(() => {
      expect(mockMap.getSource(MAP_SOURCES.userLocation)).toBeTruthy();
    });

    latestMapHandler("dragstart")?.({ originalEvent: { type: "pointerdown" } });
    mockMap.easeTo.mockClear();

    watchOnUpdate?.(deviceFix(32.09, 34.8));

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

    watchOnUpdate?.(deviceFix());

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

    await waitFor(() => {
      expect(screen.getByTestId("base-map")).toBeInTheDocument();
    });

    watchOnError?.("denied");

    expect(applyErrorMock).toHaveBeenCalledWith("denied");
    expect(screen.getByTestId("base-map")).toBeInTheDocument();
    expect(screen.queryByText(/Map is unavailable/i)).not.toBeInTheDocument();
    expect(mockMap.easeTo).not.toHaveBeenCalled();
  });

  it("does not let a later GPS update overwrite a user pan", async () => {
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalledWith("dragstart", expect.any(Function));
    });

    latestMapHandler("dragstart")?.({ originalEvent: { type: "pointerdown" } });
    mockMap.easeTo.mockClear();

    watchOnUpdate?.(deviceFix());

    expect(applyFreshFixMock).toHaveBeenCalled();
    expect(mockMap.easeTo).not.toHaveBeenCalled();
  });

  it("does not let a stale GPS result override a later user interaction", async () => {
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalledWith("zoomstart", expect.any(Function));
    });

    latestMapHandler("zoomstart")?.({ originalEvent: { type: "wheel" } });
    mockMap.easeTo.mockClear();

    watchOnUpdate?.(deviceFix(32.09, 34.80));

    expect(mockMap.easeTo).not.toHaveBeenCalled();
  });

  it("still auto-centers after a programmatic zoom that is not a user gesture", async () => {
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalledWith("zoomstart", expect.any(Function));
    });

    latestMapHandler("zoomstart")?.({});
    mockMap.easeTo.mockClear();

    watchOnUpdate?.(deviceFix());

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

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalledWith("dragstart", expect.any(Function));
    });

    watchOnUpdate?.(deviceFix(32.085312, 34.781812));
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
    watchOnUpdate?.(deviceFix(32.08, 34.78));

    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [34.78, 32.08],
      }),
    );
  });

  it("explicit current-location recenters repeatedly after manual pans", async () => {
    mockedStatus = "loading";
    const user = userEvent.setup();
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);

    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalled();
    });

    watchOnUpdate?.(deviceFix(32.085, 34.782));
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

    await user.click(
      await screen.findByRole("button", { name: "Center on my location" }),
    );
    expect(() => {
      watchOnUpdate?.(deviceFix(32.1, 34.8));
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

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalledWith("dragstart", expect.any(Function));
    });

    watchOnUpdate?.(deviceFix(32.085, 34.782));
    latestMapHandler("dragstart")?.({ originalEvent: { type: "pointerdown" } });
    mockMap.easeTo.mockClear();

    await user.click(
      await screen.findByRole("button", { name: "Center on my location" }),
    );
    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [34.782, 32.085] }),
    );

    watchOnError?.("timeout");

    expect(screen.getByTestId("base-map")).toBeInTheDocument();
    expect(screen.queryByText(/Map is unavailable/i)).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("current-location-unavailable-notice"),
    ).not.toBeInTheDocument();
  });

  it("renders at the fallback center even when a previous session camera exists", async () => {
    writeSessionMapCamera("seeker", {
      center: [34.78, 32.08],
      zoom: 16,
    });
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);

    expect(mockBaseMapProps.center).toEqual([
      MAP_DEFAULT_CENTER_TEL_AVIV.lng,
      MAP_DEFAULT_CENTER_TEL_AVIV.lat,
    ]);
    expect(screen.getByTestId("base-map")).toBeInTheDocument();
  });

  it("lets a restored session camera be replaced by a fresh GPS fix", async () => {
    writeSessionMapCamera("seeker", {
      center: [34.78, 32.08],
      zoom: 16,
    });
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);

    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalled();
    });

    watchOnUpdate?.(deviceFix(32.26, 34.89));

    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [34.89, 32.26],
      }),
    );
  });

  it("lets a later GPS sample replace the first auto-center during initialization", async () => {
    mockedStatus = "loading";
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);

    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalled();
    });

    watchOnUpdate?.(deviceFix(32.08, 34.78));
    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [34.78, 32.08] }),
    );

    mockMap.easeTo.mockClear();
    watchOnUpdate?.(deviceFix(32.26, 34.89));
    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [34.89, 32.26] }),
    );
  });

  it("starts a new location watch when the screen is opened again", async () => {
    mockedStatus = "loading";
    const { unmount } = render(
      <ParkingMapMapLibre spots={[spot]} destination={null} />,
    );

    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalled();
    });
    watchOnUpdate?.(deviceFix(32.08, 34.78));

    unmount();
    expect(stopWatchMock).toHaveBeenCalled();

    mockMap.easeTo.mockClear();
    stopWatchMock.mockClear();
    render(<ParkingMapMapLibre spots={[spot]} destination={null} />);

    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalled();
    });
    watchOnUpdate?.(deviceFix(32.26, 34.89));
    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [34.89, 32.26] }),
    );
  });
});
