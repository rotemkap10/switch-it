"use client";

import dynamic from "next/dynamic";

import type { MapSpot } from "@/types/map-spot";

const ParkingMap = dynamic(
  () => import("@/components/map/ParkingMap").then((mod) => mod.ParkingMap),
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
};

export function ParkingMapLoader({ spots }: ParkingMapLoaderProps) {
  return <ParkingMap spots={spots} />;
}
