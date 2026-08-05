"use client";

import dynamic from "next/dynamic";

import { MapLoadingState } from "@/components/map/MapLoadingState";
import type { MapSpot } from "@/types/map-spot";

const ParkingMap = dynamic(
  () =>
    import("@/components/map/ParkingMapMapLibre").then(
      (mod) => mod.ParkingMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        data-testid="parking-map-loader-shell"
        className="h-full w-full overflow-hidden"
      >
        <MapLoadingState />
      </div>
    ),
  },
);

type ParkingMapLoaderProps = {
  spots: MapSpot[];
  destination?: { latitude: number; longitude: number } | null;
  onVisuallyReady?: () => void;
  showDiscoveryCarousel?: boolean;
};

export function ParkingMapLoader({
  spots,
  destination,
  onVisuallyReady,
  showDiscoveryCarousel = true,
}: ParkingMapLoaderProps) {
  return (
    <div
      data-testid="parking-map-loader-shell"
      className="h-full w-full"
    >
      <ParkingMap
        spots={spots}
        destination={destination ?? null}
        onVisuallyReady={onVisuallyReady}
        showDiscoveryCarousel={showDiscoveryCarousel}
      />
    </div>
  );
}
