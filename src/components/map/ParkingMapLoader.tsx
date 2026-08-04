"use client";

import dynamic from "next/dynamic";

import type { MapSpot } from "@/types/map-spot";

const ParkingMap = dynamic(
  () =>
    import("@/components/map/ParkingMapMapLibre").then(
      (mod) => mod.ParkingMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[60vh] min-h-[24rem] items-center justify-center bg-accent-soft text-sm text-muted">
        Loading map…
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
