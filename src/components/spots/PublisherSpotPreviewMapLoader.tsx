"use client";

import dynamic from "next/dynamic";

import { MapLoadingState } from "@/components/map/MapLoadingState";
import type { PublisherSpotPreviewMapProps } from "@/components/spots/PublisherSpotPreviewMap";
import { publisherPreviewShellClass } from "@/lib/map/leaverMapShell";
import { loadMapLibreModule } from "@/lib/map/load-maplibre-module";

const PreviewMap = dynamic(
  () =>
    loadMapLibreModule().then(() =>
      import("@/components/spots/PublisherSpotPreviewMap").then(
        (mod) => mod.PublisherSpotPreviewMap,
      ),
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className={`overflow-hidden rounded-[var(--radius-card)] border border-border ${publisherPreviewShellClass("available")}`}
        aria-label="Parking location map"
      >
        <MapLoadingState />
      </div>
    ),
  },
);

export function PublisherSpotPreviewMapLoader(
  props: PublisherSpotPreviewMapProps,
) {
  return <PreviewMap {...props} />;
}
