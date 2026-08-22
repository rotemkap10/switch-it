import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublisherLiveProgressMap } from "@/components/spots/PublisherLiveProgressMap";
import { LIVE_LOCATION_PAUSE_WHILE_NAVIGATING } from "@/lib/location/stale";
import { MAP_SELECTED_SPOT_ZOOM } from "@/lib/map/seekerMapConfig";

type FakeMap = {
  resize: ReturnType<typeof vi.fn>;
  fitBounds: ReturnType<typeof vi.fn>;
  easeTo: ReturnType<typeof vi.fn>;
  getBounds: ReturnType<typeof vi.fn>;
  getZoom: ReturnType<typeof vi.fn>;
  getSource: ReturnType<typeof vi.fn>;
  addSource: ReturnType<typeof vi.fn>;
  addLayer: ReturnType<typeof vi.fn>;
  getLayer: ReturnType<typeof vi.fn>;
  hasImage: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  dragPan: { enable: ReturnType<typeof vi.fn>; isEnabled: ReturnType<typeof vi.fn> };
  touchZoomRotate: { enable: ReturnType<typeof vi.fn>; isEnabled: ReturnType<typeof vi.fn> };
  scrollZoom: { enable: ReturnType<typeof vi.fn> };
  keyboard: { enable: ReturnType<typeof vi.fn> };
  doubleClickZoom: { enable: ReturnType<typeof vi.fn> };
  getCanvas: ReturnType<typeof vi.fn>;
  isMoving: ReturnType<typeof vi.fn>;
};

let lastOnMapReady: ((map: FakeMap) => void) | null = null;

vi.mock("@/components/map/BaseMap", () => ({
  BaseMap: ({
    onMapReady,
  }: {
    onMapReady?: (map: FakeMap) => void;
  }) => {
    lastOnMapReady = onMapReady ?? null;
    return <div data-testid="base-map" />;
  },
}));

vi.mock("@/lib/map/seekerMarkerImages", () => ({
  SEEKER_MARKER_IMAGE_IDS: {
    destination: "spot-destination",
    seekerLive: "seeker-live",
  },
  registerSeekerMarkerImages: vi.fn(),
}));

vi.mock("@/lib/map/seekerMapConfig", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/map/seekerMapConfig")
  >("@/lib/map/seekerMapConfig");
  return {
    ...actual,
    assertMapTilerStyleUrlOrNull: () => "https://example.test/style.json",
  };
});

const parkingLatitude = 32.0853;
const parkingLongitude = 34.7818;

const seekerLocation = {
  latitude: 32.086,
  longitude: 34.782,
  accuracyMeters: 10,
  headingDegrees: null,
  sequence: 1,
  sentAt: Date.now(),
};

function createFakeMap(): FakeMap {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers = new Set<string>();
  return {
    resize: vi.fn(),
    fitBounds: vi.fn(),
    easeTo: vi.fn(),
    getBounds: vi.fn(() => ({
      contains: vi.fn(() => true),
    })),
    getZoom: vi.fn(() => MAP_SELECTED_SPOT_ZOOM),
    getSource: vi.fn((id: string) => sources.get(id)),
    addSource: vi.fn((id: string) => {
      sources.set(id, { setData: vi.fn() });
    }),
    addLayer: vi.fn((layer: { id: string }) => {
      layers.add(layer.id);
    }),
    getLayer: vi.fn((id: string) => (layers.has(id) ? { id } : undefined)),
    hasImage: vi.fn(() => true),
    on: vi.fn(),
    dragPan: { enable: vi.fn(), isEnabled: vi.fn(() => true) },
    touchZoomRotate: { enable: vi.fn(), isEnabled: vi.fn(() => true) },
    scrollZoom: { enable: vi.fn() },
    keyboard: { enable: vi.fn() },
    doubleClickZoom: { enable: vi.fn() },
    getCanvas: vi.fn(() => ({
      addEventListener: vi.fn(),
    })),
    isMoving: vi.fn(() => false),
  };
}

function simulateUserPan(map: FakeMap) {
  const dragstart = map.on.mock.calls.find(
    (call) => call[0] === "dragstart",
  )?.[1] as ((event?: { originalEvent?: unknown }) => void) | undefined;
  act(() => {
    dragstart?.({ originalEvent: { type: "pointerdown" } });
  });
}

function readyMap(map: FakeMap = createFakeMap()) {
  act(() => {
    lastOnMapReady?.(map);
  });
  return map;
}

function stubMatchMedia() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe("PublisherLiveProgressMap", () => {
  beforeEach(() => {
    lastOnMapReady = null;
    stubMatchMedia();
  });

  it("renders destination and seeker when location exists", () => {
    render(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={seekerLocation}
        statusLabel="Live location"
        updatedLabel="Updated just now"
      />,
    );

    const map = screen.getByTestId("publisher-live-progress-map");
    expect(map).toHaveAttribute("data-has-destination", "true");
    expect(map).toHaveAttribute("data-has-seeker", "true");
    expect(screen.getByTestId("publisher-live-status")).toHaveTextContent(
      "Live location",
    );
    expect(screen.getByTestId("publisher-live-updated")).toHaveTextContent(
      "Updated just now",
    );
  });

  it("uses a bottom-anchored parking pin and a centered live car", () => {
    render(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={seekerLocation}
        statusLabel="Live location"
        updatedLabel="Updated just now"
      />,
    );

    const map = readyMap();
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "publisher-live-dest-layer",
        layout: expect.objectContaining({
          "icon-image": "spot-destination",
          "icon-anchor": "bottom",
        }),
      }),
    );
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "publisher-live-seeker-layer",
        layout: expect.objectContaining({
          "icon-image": "seeker-live",
          "icon-anchor": "center",
        }),
      }),
    );
  });

  it("seeds the live car source when a known location exists at map ready", () => {
    render(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={seekerLocation}
        statusLabel="Live location"
        updatedLabel="Updated just now"
      />,
    );

    const map = readyMap();
    const seekerSource = map.addSource.mock.calls.find(
      (call) => call[0] === "publisher-live-seeker-src",
    );
    expect(seekerSource?.[1]).toEqual(
      expect.objectContaining({
        type: "geojson",
        data: expect.objectContaining({
          features: [
            expect.objectContaining({
              geometry: {
                type: "Point",
                coordinates: [seekerLocation.longitude, seekerLocation.latitude],
              },
            }),
          ],
        }),
      }),
    );
  });

  it("shows paused copy and keeps the last known seeker marker", () => {
    render(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={seekerLocation}
        statusLabel="Live location paused"
        updatedLabel="Last update 28 seconds ago"
        pauseHint={LIVE_LOCATION_PAUSE_WHILE_NAVIGATING}
      />,
    );

    expect(screen.getByTestId("publisher-live-status")).toHaveTextContent(
      "Live location paused",
    );
    expect(screen.getByTestId("publisher-live-pause-hint")).toHaveTextContent(
      LIVE_LOCATION_PAUSE_WHILE_NAVIGATING,
    );
    expect(screen.getByTestId("publisher-live-updated")).toHaveTextContent(
      "Last update 28 seconds ago",
    );
    expect(screen.getByTestId("publisher-live-progress-map")).toHaveAttribute(
      "data-has-seeker",
      "true",
    );
  });

  it("keeps the last marker during delayed updates", () => {
    render(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={seekerLocation}
        statusLabel="Location update delayed"
        updatedLabel="Updated 14 seconds ago"
      />,
    );

    expect(screen.getByTestId("publisher-live-status")).toHaveTextContent(
      "Location update delayed",
    );
    expect(screen.getByTestId("publisher-live-updated")).toHaveTextContent(
      "Updated 14 seconds ago",
    );
    expect(screen.getByTestId("publisher-live-progress-map")).toHaveAttribute(
      "data-has-seeker",
      "true",
    );
  });

  it("shows informational driver progress and a marker legend", () => {
    render(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={seekerLocation}
        statusLabel="Live location"
        updatedLabel="Updated just now"
        progressLabel="Driver is about 120 m away"
      />,
    );

    expect(screen.getByTestId("publisher-driver-distance")).toHaveTextContent(
      "Driver is about 120 m away",
    );
    expect(screen.getByTestId("publisher-live-legend")).toHaveTextContent(
      "Parking spot · Approaching driver",
    );
  });

  it("renders unavailable status without dropping the last marker", () => {
    render(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={seekerLocation}
        statusLabel="Live location temporarily unavailable"
        updatedLabel="Last update 28 seconds ago"
      />,
    );

    expect(screen.getByTestId("publisher-live-status")).toHaveTextContent(
      "Live location temporarily unavailable",
    );
    expect(screen.getByTestId("publisher-live-progress-map")).toHaveAttribute(
      "data-has-seeker",
      "true",
    );
    expect(screen.getByTestId("publisher-live-legend")).toHaveTextContent(
      "Parking spot · Approaching driver",
    );
  });

  it("omits the seeker marker before any location arrives", () => {
    render(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={null}
        statusLabel="Waiting for driver location"
        updatedLabel="Waiting"
      />,
    );

    expect(screen.getByTestId("publisher-live-status")).toHaveTextContent(
      "Waiting for driver location",
    );
    expect(screen.queryByTestId("publisher-live-updated")).not.toBeInTheDocument();
    expect(screen.getByTestId("publisher-live-progress-map")).toHaveAttribute(
      "data-has-seeker",
      "false",
    );
    expect(screen.getByTestId("publisher-live-progress-map")).toHaveAttribute(
      "data-has-destination",
      "true",
    );
    expect(screen.queryByTestId("publisher-handoff-focus")).not.toBeInTheDocument();
  });
});

describe("PublisherLiveProgressMap handoff focus", () => {
  beforeEach(() => {
    lastOnMapReady = null;
    stubMatchMedia();
  });

  it("centers on the parking spot when no seeker location exists", async () => {
    const user = userEvent.setup();
    render(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={null}
        statusLabel="Waiting for driver location"
        updatedLabel="Waiting"
      />,
    );
    const map = readyMap();
    simulateUserPan(map);

    await user.click(screen.getByTestId("publisher-handoff-focus"));

    expect(map.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [parkingLongitude, parkingLatitude],
        zoom: MAP_SELECTED_SPOT_ZOOM,
        essential: true,
      }),
    );
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it("fits parking spot and seeker with [longitude, latitude] order", () => {
    render(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={seekerLocation}
        statusLabel="Live location"
        updatedLabel="Updated just now"
      />,
    );
    const map = readyMap();

    expect(map.fitBounds).toHaveBeenCalledWith(
      [
        [parkingLongitude, parkingLatitude],
        [seekerLocation.longitude, seekerLocation.latitude],
      ],
      expect.objectContaining({ padding: 48, maxZoom: MAP_SELECTED_SPOT_ZOOM }),
    );
    const bounds = map.fitBounds.mock.calls[0]?.[0] as [
      [number, number],
      [number, number],
    ];
    expect(bounds[0][0]).toBe(parkingLongitude);
    expect(bounds[0][1]).toBe(parkingLatitude);
    expect(map.easeTo).not.toHaveBeenCalled();
  });

  it("uses last-known seeker position when paused or delayed", () => {
    render(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={seekerLocation}
        statusLabel="Live location paused"
        updatedLabel="Last update 28 seconds ago"
        pauseHint={LIVE_LOCATION_PAUSE_WHILE_NAVIGATING}
      />,
    );
    const map = readyMap();

    expect(map.fitBounds).toHaveBeenCalledWith(
      [
        [parkingLongitude, parkingLatitude],
        [seekerLocation.longitude, seekerLocation.latitude],
      ],
      expect.any(Object),
    );
  });

  it("keeps the last known seeker marker when a live update is briefly missing", () => {
    const { rerender } = render(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={seekerLocation}
        statusLabel="Live location"
        updatedLabel="Updated just now"
      />,
    );
    const map = readyMap();
    const seekerSource = map.getSource("publisher-live-seeker-src") as {
      setData: ReturnType<typeof vi.fn>;
    };
    expect(seekerSource.setData).toHaveBeenCalled();
    const callsBefore = seekerSource.setData.mock.calls.length;

    rerender(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={null}
        statusLabel="Location update delayed"
        updatedLabel="Updated 12 seconds ago"
      />,
    );

    expect(seekerSource.setData.mock.calls.length).toBe(callsBefore);
    expect(screen.getByTestId("publisher-live-progress-map")).toHaveAttribute(
      "data-has-seeker",
      "true",
    );
  });

  it("autofocuses parking + seeker once when the first live fix arrives", () => {
    const { rerender } = render(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={null}
        statusLabel="Waiting for driver location"
        updatedLabel="Waiting"
      />,
    );
    const map = readyMap();
    expect(map.fitBounds).not.toHaveBeenCalled();

    rerender(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={seekerLocation}
        statusLabel="Live location"
        updatedLabel="Updated just now"
      />,
    );

    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(map.fitBounds).toHaveBeenCalledWith(
      [
        [parkingLongitude, parkingLatitude],
        [seekerLocation.longitude, seekerLocation.latitude],
      ],
      expect.any(Object),
    );
  });

  it("does not refocus when live updates arrive after a manual pan", () => {
    const { rerender } = render(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={seekerLocation}
        statusLabel="Live location"
        updatedLabel="Updated just now"
      />,
    );
    const map = readyMap();
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    map.fitBounds.mockClear();

    const dragstart = map.on.mock.calls.find(
      (call) => call[0] === "dragstart",
    )?.[1] as ((event?: { originalEvent?: unknown }) => void) | undefined;
    expect(dragstart).toEqual(expect.any(Function));
    act(() => {
      dragstart?.({ originalEvent: { type: "pointerdown" } });
    });

    rerender(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={{
          ...seekerLocation,
          latitude: 32.087,
          longitude: 34.783,
          sequence: 2,
        }}
        statusLabel="Live location"
        updatedLabel="Updated just now"
      />,
    );

    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.easeTo).not.toHaveBeenCalled();
  });

  it("refocuses both points after an explicit tap following a live update", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={seekerLocation}
        statusLabel="Live location"
        updatedLabel="Updated just now"
      />,
    );
    const map = readyMap();
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    map.fitBounds.mockClear();

    rerender(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={{
          ...seekerLocation,
          latitude: 32.087,
          longitude: 34.783,
          sequence: 2,
        }}
        statusLabel="Live location"
        updatedLabel="Updated just now"
      />,
    );
    expect(map.fitBounds).not.toHaveBeenCalled();

    simulateUserPan(map);
    await user.click(screen.getByTestId("publisher-handoff-focus"));

    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(map.fitBounds).toHaveBeenCalledWith(
      [
        [parkingLongitude, parkingLatitude],
        [34.783, 32.087],
      ],
      expect.any(Object),
    );
  });

  it("queues the first live fit until the map is ready", async () => {
    render(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={seekerLocation}
        statusLabel="Live location"
        updatedLabel="Updated just now"
      />,
    );

    expect(lastOnMapReady).toEqual(expect.any(Function));

    const map = createFakeMap();
    readyMap(map);

    await waitFor(() => {
      expect(map.fitBounds).toHaveBeenCalledWith(
        [
          [parkingLongitude, parkingLatitude],
          [seekerLocation.longitude, seekerLocation.latitude],
        ],
        expect.any(Object),
      );
    });
  });

  it("updates the seeker marker when a later payload arrives", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const { rerender } = render(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={seekerLocation}
        statusLabel="Live location"
        updatedLabel="Updated just now"
      />,
    );
    const map = readyMap();
    const seekerSource = map.getSource("publisher-live-seeker-src") as {
      setData: ReturnType<typeof vi.fn>;
    };
    expect(seekerSource.setData).toHaveBeenCalled();
    seekerSource.setData.mockClear();

    rerender(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={{
          ...seekerLocation,
          latitude: 32.087,
          longitude: 34.783,
          sequence: 2,
        }}
        statusLabel="Live location"
        updatedLabel="Updated just now"
      />,
    );

    expect(seekerSource.setData).toHaveBeenCalled();
    const lastData = seekerSource.setData.mock.calls.at(-1)?.[0] as {
      features: Array<{ geometry: { coordinates: [number, number] } }>;
    };
    expect(lastData.features[0]?.geometry.coordinates).toEqual([34.783, 32.087]);
  });

  it("keeps auto-framing on by default and only shows Recenter after a manual pan", () => {
    render(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={seekerLocation}
        statusLabel="Live location"
        updatedLabel="Updated just now"
      />,
    );
    const map = readyMap();
    expect(map.dragPan.enable).toHaveBeenCalled();
    expect(map.touchZoomRotate.enable).toHaveBeenCalled();
    expect(screen.getByTestId("publisher-live-progress-map")).toHaveAttribute(
      "data-drag-pan",
      "enabled",
    );
    expect(screen.getByTestId("publisher-live-progress-map")).toHaveAttribute(
      "data-pinch-zoom",
      "enabled",
    );
    expect(screen.queryByTestId("publisher-handoff-focus")).not.toBeInTheDocument();
    simulateUserPan(map);

    expect(screen.getByTestId("publisher-handoff-focus")).toHaveTextContent(
      "Recenter",
    );
    expect(screen.getByTestId("publisher-live-progress-map")).toContainElement(
      screen.getByTestId("publisher-handoff-focus"),
    );
    expect(screen.getByTestId("publisher-handoff-focus")).toHaveClass(
      "h-11",
      "w-11",
      "rounded-full",
    );
    expect(screen.getByTestId("publisher-handoff-focus")).not.toHaveClass(
      "rounded-lg",
    );
    expect(screen.queryByText("Follow")).not.toBeInTheDocument();
  });

  it("does not move the camera from live updates while the map reports a user move", () => {
    const { rerender } = render(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={seekerLocation}
        statusLabel="Live location"
        updatedLabel="Updated just now"
      />,
    );
    const map = readyMap();
    map.fitBounds.mockClear();
    map.isMoving.mockReturnValue(true);

    rerender(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={{
          ...seekerLocation,
          latitude: 32.09,
          longitude: 34.79,
          sequence: 3,
        }}
        statusLabel="Live location"
        updatedLabel="Updated just now"
      />,
    );

    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.easeTo).not.toHaveBeenCalled();
  });

  it("shows Recenter only after a manual pan, as type=button", () => {
    render(
      <PublisherLiveProgressMap
        parkingLatitude={parkingLatitude}
        parkingLongitude={parkingLongitude}
        seekerLocation={null}
        statusLabel="Waiting for driver location"
        updatedLabel="Waiting"
      />,
    );
    const map = readyMap();
    expect(screen.queryByTestId("publisher-handoff-focus")).not.toBeInTheDocument();
    simulateUserPan(map);

    expect(screen.getByTestId("publisher-handoff-focus")).toHaveTextContent(
      "Recenter",
    );
    expect(screen.getByTestId("publisher-handoff-focus")).toHaveAttribute(
      "type",
      "button",
    );
    expect(screen.getByTestId("publisher-live-progress-map")).toContainElement(
      screen.getByTestId("publisher-handoff-focus"),
    );
    expect(
      screen.getByRole("button", { name: "Recenter on the parking spot" }),
    ).toHaveClass("rounded-full");
    expect(screen.queryByText("Follow")).not.toBeInTheDocument();
  });
});
