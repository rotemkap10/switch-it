"use client";

import dynamic from "next/dynamic";

import { MapLoadingState } from "@/components/map/MapLoadingState";
import type { PublisherLiveProgressMapProps } from "@/components/spots/PublisherLiveProgressMap";
import { loadMapLibreModule } from "@/lib/map/load-maplibre-module";

/**
 * Match claimed-handoff production mount (`expanded` on PublisherSpotCard).
 * Do not use publisher-preview heights — those are a different card size.
 */
function LiveProgressChunkLoading() {
  return (
    <div
      className="publisher-live-map-shell publisher-live-map-shell--expanded overflow-hidden rounded-[var(--radius-card)] border border-border"
      aria-label="Live progress map"
      data-testid="publisher-live-progress-chunk-loading"
      data-map-shell="stable"
      data-expanded="true"
    >
      <MapLoadingState />
    </div>
  );
}

const LiveMap = dynamic(
  () =>
    loadMapLibreModule().then(() =>
      import("@/components/spots/PublisherLiveProgressMap").then(
        (mod) => mod.PublisherLiveProgressMap,
      ),
    ),
  {
    ssr: false,
    loading: () => <LiveProgressChunkLoading />,
  },
);

export function PublisherLiveProgressMapLoader(
  props: PublisherLiveProgressMapProps,
) {
  return <LiveMap {...props} />;
}
