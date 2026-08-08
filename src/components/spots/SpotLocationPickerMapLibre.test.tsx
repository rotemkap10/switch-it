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
      props.onMapReady(mockMap);
      props.onVisuallyReady?.();
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
  NavigationControl: vi.fn(function NavigationControl() {
    return {};
  }),
}));

import {
  setPickerMapInteractionEnabled,
  SpotLocationPickerMapLibre,
} from "@/components/spots/SpotLocationPickerMapLibre";

describe("SpotLocationPickerMapLibre", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = "test-key";
    recenterMock.mockReset();
    recenterPending = false;
    recenterOnFix = null;
    recenterOnError = null;
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
  });

  it("enables pan/zoom handlers and disables rotation", async () => {
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

  it("treats a user pan as an intentional pin move", async () => {
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
    )?.[1] as (() => void) | undefined;
    expect(movestartHandler).toBeTypeOf("function");
    movestartHandler?.();

    expect(onMapInteractionStart).toHaveBeenCalledTimes(1);
    expect(onUserMovedMap).toHaveBeenCalledTimes(1);
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
    expect(mockMap.dragPan.enable).toHaveBeenCalled();
    expect(mockMap.touchZoomRotate.disableRotation).toHaveBeenCalled();

    setPickerMapInteractionEnabled(mockMap as never, false);
    expect(mockMap.dragPan.disable).toHaveBeenCalled();
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
});
