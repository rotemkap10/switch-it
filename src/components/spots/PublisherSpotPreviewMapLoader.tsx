"use client";

import dynamic from "next/dynamic";

import { MapLoadingState } from "@/components/map/MapLoadingState";
import type { PublisherSpotPreviewMapProps } from "@/components/spots/PublisherSpotPreviewMap";
import { loadMapLibreModule } from "@/lib/map/load-maplibre-module";

const PREVIEW_HEIGHT_CLASS = "h-[220px]";

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
        className={`overflow-hidden rounded-[var(--radius-card)] border border-border ${PREVIEW_HEIGHT_CLASS}`}
        aria-label="Map preview of your parking spot"
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
