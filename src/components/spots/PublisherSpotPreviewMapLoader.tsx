"use client";

import dynamic from "next/dynamic";

import { MapLoadingState } from "@/components/map/MapLoadingState";
import type { PublisherSpotPreviewMapProps } from "@/components/spots/PublisherSpotPreviewMap";
import { publisherPreviewShellClass } from "@/lib/map/leaverMapShell";
import { loadMapLibreModule } from "@/lib/map/load-maplibre-module";

/** Default variant matches PublisherSpotPreviewMap's default (`available`). */
function PreviewChunkLoading() {
  return (
    <div
      className={`overflow-hidden rounded-[var(--radius-card)] border border-border ${publisherPreviewShellClass("available")}`}
      aria-label="Parking location map"
      data-testid="publisher-spot-preview-chunk-loading"
      data-map-shell="stable"
      data-preview-variant="available"
    >
      <MapLoadingState />
    </div>
  );
}

const PreviewMap = dynamic(
  () =>
    loadMapLibreModule().then(() =>
      import("@/components/spots/PublisherSpotPreviewMap").then(
        (mod) => mod.PublisherSpotPreviewMap,
      ),
    ),
  {
    ssr: false,
    loading: () => <PreviewChunkLoading />,
  },
);

export function PublisherSpotPreviewMapLoader(
  props: PublisherSpotPreviewMapProps,
) {
  return <PreviewMap {...props} />;
}
