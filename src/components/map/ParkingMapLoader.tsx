"use client";

import dynamic from "next/dynamic";

import type { MapSpot } from "@/types/map-spot";

const ParkingMap = dynamic(
  () => import("@/components/map/ParkingMap").then((mod) => mod.ParkingMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[60vh] min-h-[24rem] items-center justify-center rounded border border-zinc-200 bg-zinc-100 text-sm text-zinc-600">
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
