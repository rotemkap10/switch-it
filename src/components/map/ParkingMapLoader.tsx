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
      <div className="h-[60vh] min-h-[24rem] w-full overflow-hidden">
        <MapLoadingState />
      </div>
    ),
  },
);

type ParkingMapLoaderProps = {
  spots: MapSpot[];
  destination?: { latitude: number; longitude: number } | null;
};

export function ParkingMapLoader({ spots, destination }: ParkingMapLoaderProps) {
  return <ParkingMap spots={spots} destination={destination ?? null} />;
}
