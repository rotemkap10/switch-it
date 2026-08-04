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
  dragPan: { enable: vi.fn(), disable: vi.fn() },
  scrollZoom: { enable: vi.fn(), disable: vi.fn() },
  boxZoom: { enable: vi.fn(), disable: vi.fn() },
  doubleClickZoom: { enable: vi.fn(), disable: vi.fn() },
  touchZoomRotate: { enable: vi.fn(), disable: vi.fn() },
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

import { SpotLocationPickerMapLibre } from "@/components/spots/SpotLocationPickerMapLibre";

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
  });

  it("renders the map with a fixed-height center-pin shell", async () => {
    render(
      <SpotLocationPickerMapLibre
        latitude={32.085312}
        longitude={34.781812}
        onLocationChange={vi.fn()}
      />,
    );

    const region = await screen.findByLabelText(
      "Map to adjust your parking spot location",
    );
    expect(region).toBeInTheDocument();
    expect(region.className).toContain("h-[260px]");
    expect(screen.getByTestId("base-map")).toBeInTheDocument();
  });

  it("updates coordinates from map center when movement ends", async () => {
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

    const moveendHandler = mockMap.on.mock.calls.find(
      (call) => call[0] === "moveend",
    )?.[1] as (() => void) | undefined;
    expect(moveendHandler).toBeTypeOf("function");
    moveendHandler?.();

    expect(onLocationChange).toHaveBeenCalledWith(32.1, 34.8);
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
