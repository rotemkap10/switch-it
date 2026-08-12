import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockMap = {
  getCenter: vi.fn(() => ({ lat: 32.085312, lng: 34.781812 })),
  jumpTo: vi.fn(),
  easeTo: vi.fn(),
  once: vi.fn((_event: string, handler: () => void) => {
    handler();
  }),
  on: vi.fn(),
  resize: vi.fn(),
  getZoom: vi.fn(() => 16),
  getContainer: vi.fn(() => document.createElement("div")),
  addControl: vi.fn(),
  addSource: vi.fn(),
  getSource: vi.fn(),
  addLayer: vi.fn(),
  getLayer: vi.fn(),
  project: vi.fn(() => ({ x: 0, y: 0 })),
  dragPan: { enable: vi.fn(), disable: vi.fn() },
  scrollZoom: { enable: vi.fn(), disable: vi.fn() },
  boxZoom: { enable: vi.fn(), disable: vi.fn() },
  doubleClickZoom: { enable: vi.fn(), disable: vi.fn() },
  touchZoomRotate: {
    enable: vi.fn(),
    disable: vi.fn(),
    disableRotation: vi.fn(),
  },
  keyboard: { enable: vi.fn(), disable: vi.fn() },
};

const recenterMock = vi.fn();
let recenterPending = false;
let recenterOnFix: ((fix: {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}) => void) | null = null;
let recenterOnError: (() => void) | null = null;
let deferMapReady = false;
let pendingMapReady: (() => void) | null = null;

vi.mock("@/lib/map/use-map-recenter", () => ({
  useMapRecenter: (options: {
    onFix?: (fix: {
      latitude: number;
      longitude: number;
      accuracy: number | null;
      timestamp: number;
    }) => void;
    onError?: () => void;
  }) => {
    recenterOnFix = options.onFix ?? null;
    recenterOnError = options.onError ?? null;
    return {
      recenter: recenterMock,
      pending: recenterPending,
    };
  },
}));

vi.mock("@/components/map/BaseMap", () => ({
  BaseMap: (props: {
    onMapReady: (map: typeof mockMap) => void;
    onVisuallyReady?: () => void;
    center: [number, number];
    zoom: number;
  }) => {
    useEffect(() => {
      const ready = () => {
        props.onMapReady(mockMap);
        props.onVisuallyReady?.();
      };
      if (deferMapReady) {
        pendingMapReady = ready;
        return;
      }
      ready();
    }, [props]);
    return <div data-testid="base-map" />;
  },
}));

vi.mock("@/components/map/MapUnavailable", () => ({
  MapUnavailable: ({
    reason = "temporary",
    onRetry,
  }: {
    reason?: string;
    onRetry?: () => void;
  }) => (
    <div>
      <p>Map is unavailable</p>
      <p data-testid="map-unavailable-reason">{reason}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("maplibre-gl", () => ({
  NavigationControl: vi.fn(function NavigationControl(
    this: unknown,
    options?: {
      showCompass?: boolean;
      visualizePitch?: boolean;
      showZoom?: boolean;
    },
  ) {
    return { options };
  }),
}));

import {
  setPickerMapInteractionEnabled,
  SpotLocationPickerMapLibre,
} from "@/components/spots/SpotLocationPickerMapLibre";
import { MAP_DEFAULT_CENTER } from "@/types/map-spot";
import { PICKER_USER_LOCATION_IDS } from "@/lib/map/user-location-dot";
import { LEAVER_MAP_ZOOM_CONTROLS_MEDIA_QUERY } from "@/lib/map/leaverMapShell";
import { NavigationControl } from "maplibre-gl";

function stubLeaverMapViewport(desktop: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === LEAVER_MAP_ZOOM_CONTROLS_MEDIA_QUERY ? desktop : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("SpotLocationPickerMapLibre", () => {
  beforeEach(() => {
    stubLeaverMapViewport(false);
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = "test-key";
    recenterMock.mockReset();
    recenterPending = false;
    recenterOnFix = null;
    recenterOnError = null;
    deferMapReady = false;
    pendingMapReady = null;
    mockMap.getCenter.mockReset();
    mockMap.getCenter.mockReturnValue({ lat: 32.085312, lng: 34.781812 });
    mockMap.jumpTo.mockReset();
    mockMap.easeTo.mockReset();
    mockMap.once.mockReset();
    mockMap.once.mockImplementation((_event: string, handler: () => void) => {
      handler();
    });
    mockMap.on.mockReset();
    mockMap.resize.mockReset();
    mockMap.addControl.mockReset();
    mockMap.getContainer.mockReturnValue(document.createElement("div"));
    mockMap.getZoom.mockReturnValue(16);
    const sources = new Map<string, { type: string; setData: ReturnType<typeof vi.fn> }>();
    const layers = new Set<string>();
    mockMap.addSource.mockReset();
    mockMap.addSource.mockImplementation((id: string) => {
      sources.set(id, { type: "geojson", setData: vi.fn() });
    });
    mockMap.getSource.mockReset();
    mockMap.getSource.mockImplementation((id: string) => sources.get(id));
    mockMap.addLayer.mockReset();
    mockMap.addLayer.mockImplementation((layer: { id: string }) => {
      layers.add(layer.id);
    });
    mockMap.getLayer.mockReset();
    mockMap.getLayer.mockImplementation((id: string) =>
      layers.has(id) ? { id } : undefined,
    );
    mockMap.project.mockReset();
    mockMap.project.mockReturnValue({ x: 0, y: 0 });
    for (const handler of [
      mockMap.dragPan,
      mockMap.scrollZoom,
      mockMap.boxZoom,
      mockMap.doubleClickZoom,
      mockMap.touchZoomRotate,
      mockMap.keyboard,
    ]) {
      handler.enable.mockReset();
      handler.disable.mockReset();
    }
    mockMap.touchZoomRotate.disableRotation.mockReset();
    vi.mocked(NavigationControl).mockClear();
  });

  it("does not add MapLibre zoom NavigationControl on mobile viewports", async () => {
    stubLeaverMapViewport(false);

    render(
      <SpotLocationPickerMapLibre
        latitude={32.085312}
        longitude={34.781812}
        onLocationChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalled();
    });

    expect(mockMap.addControl).not.toHaveBeenCalled();
    expect(NavigationControl).not.toHaveBeenCalled();
  });

  it("adds MapLibre NavigationControl with zoom on desktop viewports", async () => {
    stubLeaverMapViewport(true);

    render(
      <SpotLocationPickerMapLibre
        latitude={32.085312}
        longitude={34.781812}
        onLocationChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(mockMap.addControl).toHaveBeenCalled();
    });

    expect(NavigationControl).toHaveBeenCalledWith({
      showCompass: false,
      visualizePitch: false,
      showZoom: true,
    });
  });

  it("enables pan/zoom handlers with shared inertia and disables rotation", async () => {
    stubLeaverMapViewport(true);
    render(
      <SpotLocationPickerMapLibre
        latitude={32.085312}
        longitude={34.781812}
        onLocationChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(mockMap.dragPan.enable).toHaveBeenCalled();
    });
    expect(mockMap.dragPan.enable).toHaveBeenCalledWith({
      linearity: 0.3,
      deceleration: 2500,
      maxSpeed: 1400,
    });
    expect(mockMap.scrollZoom.enable).toHaveBeenCalled();
    expect(mockMap.touchZoomRotate.enable).toHaveBeenCalled();
    expect(mockMap.touchZoomRotate.disableRotation).toHaveBeenCalled();
    expect(mockMap.keyboard.enable).toHaveBeenCalled();
    expect(mockMap.addControl).toHaveBeenCalled();
  });

  it("keeps the center-pin overlay pointer-events-none without map-canvas-fade", async () => {
    render(
      <SpotLocationPickerMapLibre
        latitude={32.085312}
        longitude={34.781812}
        onLocationChange={vi.fn()}
      />,
    );

    const overlay = await screen.findByTestId("leaver-center-pin-overlay");
    expect(overlay.className).toContain("pointer-events-none");
    expect(overlay.className).toContain("map-pin-fade");
    expect(overlay.className).not.toContain("map-canvas-fade");
  });

  it("updates coordinates from map center on moveend only", async () => {
    const onLocationChange = vi.fn();
    mockMap.getCenter.mockReturnValue({ lat: 32.1, lng: 34.8 });

    render(
      <SpotLocationPickerMapLibre
        latitude={32.085312}
        longitude={34.781812}
        onLocationChange={onLocationChange}
      />,
    );

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalled();
    });

    const moveHandler = mockMap.on.mock.calls.find(
      (call) => call[0] === "move",
    )?.[1];
    expect(moveHandler).toBeUndefined();

    const moveendHandler = mockMap.on.mock.calls.find(
      (call) => call[0] === "moveend",
    )?.[1] as (() => void) | undefined;
    expect(moveendHandler).toBeTypeOf("function");
    moveendHandler?.();

    expect(onLocationChange).toHaveBeenCalledTimes(1);
    expect(onLocationChange).toHaveBeenCalledWith(32.1, 34.8);
    expect(await screen.findByText("Location selected")).toBeInTheDocument();
  });

  it("treats a user pan as an intentional pin move only when the center changes", async () => {
    const onUserMovedMap = vi.fn();
    const onMapInteractionStart = vi.fn();
    const onLocationChange = vi.fn();
    mockMap.getCenter.mockReturnValue({ lat: 32.1, lng: 34.8 });

    render(
      <SpotLocationPickerMapLibre
        latitude={32.085312}
        longitude={34.781812}
        onLocationChange={onLocationChange}
        onUserMovedMap={onUserMovedMap}
        onMapInteractionStart={onMapInteractionStart}
      />,
    );

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalled();
    });

    const movestartHandler = mockMap.on.mock.calls.find(
      (call) => call[0] === "movestart",
    )?.[1] as ((event?: unknown) => void) | undefined;
    const moveendHandler = mockMap.on.mock.calls.find(
      (call) => call[0] === "moveend",
    )?.[1] as (() => void) | undefined;

    movestartHandler?.({ originalEvent: { type: "pointerdown" } });
    expect(onMapInteractionStart).toHaveBeenCalledTimes(1);
    expect(onUserMovedMap).not.toHaveBeenCalled();

    moveendHandler?.();
    expect(onUserMovedMap).toHaveBeenCalledTimes(1);
    expect(onLocationChange).toHaveBeenCalledWith(32.1, 34.8);
  });

  it("does not treat programmatic map movement as a user pin move", async () => {
    const onUserMovedMap = vi.fn();
    const onMapInteractionStart = vi.fn();

    render(
      <SpotLocationPickerMapLibre
        latitude={32.085312}
        longitude={34.781812}
        onLocationChange={vi.fn()}
        onUserMovedMap={onUserMovedMap}
        onMapInteractionStart={onMapInteractionStart}
      />,
    );

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalled();
    });

    const movestartHandler = mockMap.on.mock.calls.find(
      (call) => call[0] === "movestart",
    )?.[1] as ((event?: unknown) => void) | undefined;
    movestartHandler?.({});
    movestartHandler?.({ originalEvent: undefined });

    expect(onMapInteractionStart).not.toHaveBeenCalled();
    expect(onUserMovedMap).not.toHaveBeenCalled();
  });

  it("settles reverse geocode when moveend does not change the pin", async () => {
    const onMapInteractionSettled = vi.fn();
    const onLocationChange = vi.fn();
    mockMap.getCenter.mockReturnValue({ lat: 32.085312, lng: 34.781812 });

    render(
      <SpotLocationPickerMapLibre
        latitude={32.085312}
        longitude={34.781812}
        onLocationChange={onLocationChange}
        onMapInteractionSettled={onMapInteractionSettled}
      />,
    );

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalled();
    });

    const moveendHandler = mockMap.on.mock.calls.find(
      (call) => call[0] === "moveend",
    )?.[1] as (() => void) | undefined;
    moveendHandler?.();

    expect(onLocationChange).not.toHaveBeenCalled();
    expect(onMapInteractionSettled).toHaveBeenCalledTimes(1);
  });

  it("exposes setPickerMapInteractionEnabled for handler contracts", () => {
    setPickerMapInteractionEnabled(mockMap as never, true);
    expect(mockMap.dragPan.enable).toHaveBeenCalledWith({
      linearity: 0.3,
      deceleration: 2500,
      maxSpeed: 1400,
    });
    expect(mockMap.touchZoomRotate.disableRotation).toHaveBeenCalled();

    setPickerMapInteractionEnabled(mockMap as never, false);
    expect(mockMap.dragPan.disable).toHaveBeenCalled();
  });

  it("does not jumpTo over an in-progress user pan when props change", async () => {
    mockMap.isMoving = vi.fn(() => false);
    mockMap.getCenter.mockReturnValue({ lat: 32.085312, lng: 34.781812 });

    const { rerender } = render(
      <SpotLocationPickerMapLibre
        latitude={32.085312}
        longitude={34.781812}
        onLocationChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalled();
    });

    const movestartHandler = mockMap.on.mock.calls.find(
      (call) => call[0] === "movestart",
    )?.[1] as ((event: { originalEvent?: Event }) => void) | undefined;

    mockMap.jumpTo.mockClear();
    movestartHandler?.({ originalEvent: new Event("touchstart") });

    rerender(
      <SpotLocationPickerMapLibre
        latitude={32.1}
        longitude={34.8}
        onLocationChange={vi.fn()}
      />,
    );

    expect(mockMap.jumpTo).not.toHaveBeenCalled();
  });

  it("shows current-location control even without cached user coordinates", async () => {
    render(
      <SpotLocationPickerMapLibre
        latitude={32.09}
        longitude={34.79}
        onLocationChange={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("button", { name: "Use my current location" }),
    ).toBeInTheDocument();
  });

  it("requests fresh location and recenters the existing map instance", async () => {
    const user = userEvent.setup();
    const onLocationChange = vi.fn();
    const onCurrentLocationResolved = vi.fn();

    render(
      <SpotLocationPickerMapLibre
        latitude={32.09}
        longitude={34.79}
        onLocationChange={onLocationChange}
        onCurrentLocationResolved={onCurrentLocationResolved}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Use my current location" }),
    );

    expect(recenterMock).toHaveBeenCalledTimes(1);

    recenterOnFix?.({
      latitude: 32.085312,
      longitude: 34.781812,
      accuracy: 10,
      timestamp: Date.now(),
    });

    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [34.781812, 32.085312],
      }),
    );
    expect(onCurrentLocationResolved).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 32.085312,
        longitude: 34.781812,
        accuracy: 10,
      }),
    );
    expect(onLocationChange).toHaveBeenCalled();
  });

  it("shows friendly feedback when recenter geolocation fails", async () => {
    render(
      <SpotLocationPickerMapLibre
        latitude={32.09}
        longitude={34.79}
        onLocationChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("picker-current-location-control")).toBeInTheDocument();
    });

    recenterOnError?.();

    expect(
      await screen.findByTestId("current-location-unavailable-notice"),
    ).toHaveTextContent("Current location is unavailable.");
    expect(screen.getByTestId("base-map")).toBeInTheDocument();
  });

  it("uses the responsive leaver picker shell height class", async () => {
    render(
      <SpotLocationPickerMapLibre
        latitude={32.085312}
        longitude={34.781812}
        onLocationChange={vi.fn()}
      />,
    );

    const picker = await screen.findByTestId("leaver-map-picker");
    expect(picker.className).toContain("leaver-map-picker-shell");
    expect(picker.className).not.toContain("h-[260px]");
  });

  it("moves the camera when GPS updates the selected coordinates", async () => {
    mockMap.getCenter.mockReturnValue({
      lat: MAP_DEFAULT_CENTER.lat,
      lng: MAP_DEFAULT_CENTER.lng,
    });

    const { rerender } = render(
      <SpotLocationPickerMapLibre
        latitude={MAP_DEFAULT_CENTER.lat}
        longitude={MAP_DEFAULT_CENTER.lng}
        onLocationChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalled();
    });

    rerender(
      <SpotLocationPickerMapLibre
        latitude={32.26}
        longitude={34.89}
        onLocationChange={vi.fn()}
      />,
    );

    expect(mockMap.jumpTo).toHaveBeenCalledWith({
      center: [34.89, 32.26],
    });
  });

  it("does not render a current-location dot until a device location exists", async () => {
    render(
      <SpotLocationPickerMapLibre
        latitude={32.085312}
        longitude={34.781812}
        onLocationChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(mockMap.on).toHaveBeenCalled();
    });

    expect(mockMap.addLayer).not.toHaveBeenCalled();
    expect(mockMap.getSource(PICKER_USER_LOCATION_IDS.dotSource)).toBeUndefined();
  });

  it("shows the current-location dot from the initial device location without clicking Current Location", async () => {
    render(
      <SpotLocationPickerMapLibre
        latitude={32.085312}
        longitude={34.781812}
        userLatitude={32.085312}
        userLongitude={34.781812}
        userAccuracy={12}
        onLocationChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalledWith(
        expect.objectContaining({ id: PICKER_USER_LOCATION_IDS.dotLayer }),
      );
    });

    const dotSource = mockMap.getSource(PICKER_USER_LOCATION_IDS.dotSource) as {
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

  it("keeps the current-location dot after a user pan without treating GPS as a camera lock", async () => {
    const onUserMovedMap = vi.fn();
    mockMap.getCenter.mockReturnValue({ lat: 32.085312, lng: 34.781812 });
    const { rerender } = render(
      <SpotLocationPickerMapLibre
        latitude={32.085312}
        longitude={34.781812}
        userLatitude={32.085312}
        userLongitude={34.781812}
        onLocationChange={vi.fn()}
        onUserMovedMap={onUserMovedMap}
      />,
    );

    await waitFor(() => {
      expect(mockMap.addLayer).toHaveBeenCalled();
    });

    const movestartHandler = mockMap.on.mock.calls.find(
      (call) => call[0] === "movestart",
    )?.[1] as ((event?: unknown) => void) | undefined;
    const moveendHandler = mockMap.on.mock.calls.find(
      (call) => call[0] === "moveend",
    )?.[1] as (() => void) | undefined;
    movestartHandler?.({ originalEvent: { type: "pointerdown" } });
    mockMap.getCenter.mockReturnValue({ lat: 32.1, lng: 34.8 });
    moveendHandler?.();
    expect(onUserMovedMap).toHaveBeenCalledTimes(1);

    rerender(
      <SpotLocationPickerMapLibre
        latitude={32.1}
        longitude={34.8}
        userLatitude={32.085312}
        userLongitude={34.781812}
        onLocationChange={vi.fn()}
        onUserMovedMap={onUserMovedMap}
      />,
    );

    const dotSource = mockMap.getSource(PICKER_USER_LOCATION_IDS.dotSource) as {
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

  it("applies a pending GPS camera jump when map becomes ready after GPS props changed", async () => {
    deferMapReady = true;
    mockMap.getCenter.mockReturnValue({
      lat: MAP_DEFAULT_CENTER.lat,
      lng: MAP_DEFAULT_CENTER.lng,
    });

    const { rerender } = render(
      <SpotLocationPickerMapLibre
        latitude={MAP_DEFAULT_CENTER.lat}
        longitude={MAP_DEFAULT_CENTER.lng}
        onLocationChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("base-map")).toBeInTheDocument();
    expect(pendingMapReady).not.toBeNull();

    rerender(
      <SpotLocationPickerMapLibre
        latitude={32.26}
        longitude={34.89}
        userLatitude={32.26}
        userLongitude={34.89}
        userAccuracy={10}
        onLocationChange={vi.fn()}
      />,
    );

    expect(mockMap.jumpTo).not.toHaveBeenCalled();

    pendingMapReady?.();

    await waitFor(() => {
      expect(mockMap.jumpTo).toHaveBeenCalledWith({
        center: [34.89, 32.26],
      });
    });
  });

  it("uses a parking P mark in the center pin instead of a tiny car", async () => {
    render(
      <SpotLocationPickerMapLibre
        latitude={32.085312}
        longitude={34.781812}
        onLocationChange={vi.fn()}
      />,
    );

    const overlay = await screen.findByTestId("leaver-center-pin-overlay");
    const svg = overlay.querySelector("svg");
    expect(svg?.innerHTML).toContain("M16.1 12.6h5.1");
    expect(svg?.innerHTML).not.toContain("M12.8 19.2");
    expect(svg?.querySelectorAll("circle")).toHaveLength(1);
  });
});
