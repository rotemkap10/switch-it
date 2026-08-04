import { render, screen, waitFor } from "@testing-library/react";
import React, { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MapSpot } from "@/types/map-spot";
import {
  MAP_LAYERS,
  MAP_SOURCES,
} from "@/lib/map/seekerMapConfig";

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
  | "denied"
  | "unavailable"
  | "timeout"
  | "unsupported";

let mockedStatus: LocationStatus = "denied";

vi.mock("@/lib/map/use-user-location", () => {
  return {
    useUserLocation: () => ({
      state: { status: mockedStatus },
    }),
  };
});

import { ParkingMapMapLibre } from "@/components/map/ParkingMapMapLibre";

describe("ParkingMapMapLibre geolocation", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = "test-key";

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
      fitBounds: vi.fn(),
      getZoom: vi.fn(() => 14),
      getCanvas: vi.fn(() => ({ style: {} })),
      getCenter: vi.fn(() => ({ lng: 34.843, lat: 32.167 })),
      project: vi.fn(() => ({ x: 0, y: 0 })),
      remove: vi.fn(),
    };

    mockedStatus = "denied";
    mockBaseMapProps.center = undefined;
    mockBaseMapProps.zoom = undefined;
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
});
