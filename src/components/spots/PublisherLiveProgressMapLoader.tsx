"use client";

import dynamic from "next/dynamic";

import { MapLoadingState } from "@/components/map/MapLoadingState";
import type { PublisherLiveProgressMapProps } from "@/components/spots/PublisherLiveProgressMap";
import { publisherPreviewShellClass } from "@/lib/map/leaverMapShell";
import { loadMapLibreModule } from "@/lib/map/load-maplibre-module";

const LiveMap = dynamic(
  () =>
    loadMapLibreModule().then(() =>
      import("@/components/spots/PublisherLiveProgressMap").then(
        (mod) => mod.PublisherLiveProgressMap,
      ),
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className={`overflow-hidden rounded-[var(--radius-card)] border border-border ${publisherPreviewShellClass("claimed")}`}
        aria-label="Live progress map"
      >
        <MapLoadingState />
      </div>
    ),
  },
);

export function PublisherLiveProgressMapLoader(
  props: PublisherLiveProgressMapProps,
) {
  return <LiveMap {...props} />;
}
