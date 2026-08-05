import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockMap = {
  getCenter: vi.fn(() => ({ lat: 32.085312, lng: 34.781812 })),
  jumpTo: vi.fn(),
  easeTo: vi.fn(),
  once: vi.fn(),
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
  MapUnavailable: () => <div>Map is unavailable</div>,
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
    mockMap.getCenter.mockReset();
    mockMap.getCenter.mockReturnValue({ lat: 32.085312, lng: 34.781812 });
    mockMap.jumpTo.mockReset();
    mockMap.easeTo.mockReset();
    mockMap.once.mockReset();
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

  it("exposes setPickerMapInteractionEnabled for handler contracts", () => {
    setPickerMapInteractionEnabled(mockMap as never, true);
    expect(mockMap.dragPan.enable).toHaveBeenCalled();
    expect(mockMap.touchZoomRotate.disableRotation).toHaveBeenCalled();

    setPickerMapInteractionEnabled(mockMap as never, false);
    expect(mockMap.dragPan.disable).toHaveBeenCalled();
  });

  it("shows recenter when a user location is provided and jumps back to it", async () => {
    const user = userEvent.setup();
    const onLocationChange = vi.fn();

    render(
      <SpotLocationPickerMapLibre
        latitude={32.09}
        longitude={34.79}
        onLocationChange={onLocationChange}
        userLatitude={32.085312}
        userLongitude={34.781812}
      />,
    );

    const recenter = await screen.findByRole("button", {
      name: "Recenter on my location",
    });
    await user.click(recenter);

    expect(mockMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [34.781812, 32.085312],
      }),
    );
  });

  it("hides recenter when no user location is available", async () => {
    render(
      <SpotLocationPickerMapLibre
        latitude={32.167}
        longitude={34.843}
        onLocationChange={vi.fn()}
      />,
    );

    await screen.findByTestId("base-map");
    expect(
      screen.queryByRole("button", { name: "Recenter on my location" }),
    ).not.toBeInTheDocument();
  });
});
