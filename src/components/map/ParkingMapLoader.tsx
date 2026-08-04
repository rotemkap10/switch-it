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
      <div className="h-full min-h-[18rem] w-full overflow-hidden">
        <MapLoadingState />
      </div>
    ),
  },
);

type ParkingMapLoaderProps = {
  spots: MapSpot[];
  destination?: { latitude: number; longitude: number } | null;
  onVisuallyReady?: () => void;
};

export function ParkingMapLoader({
  spots,
  destination,
  onVisuallyReady,
}: ParkingMapLoaderProps) {
  return (
    <div className="h-full min-h-[18rem] w-full">
      <ParkingMap
        spots={spots}
        destination={destination ?? null}
        onVisuallyReady={onVisuallyReady}
      />
    </div>
  );
}
