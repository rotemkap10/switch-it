"use client";

import dynamic from "next/dynamic";

import type { ComponentProps } from "react";

import { MapLoadingState } from "@/components/map/MapLoadingState";
import type { SpotLocationPicker } from "@/components/spots/SpotLocationPickerMapLibre";
import { LEAVER_MAP_SHELL_FILL_CLASS } from "@/lib/map/leaverMapShell";
import { loadMapLibreModule } from "@/lib/map/load-maplibre-module";

/**
 * Chunk-load fallback must use the map-first fill shell — never the legacy
 * card-height picker. Share a Spot only mounts this loader with layout="fill".
 */
function SpotLocationPickerChunkLoading() {
  return (
    <div
      className={["relative w-full overflow-hidden", LEAVER_MAP_SHELL_FILL_CLASS].join(
        " ",
      )}
      aria-label="Map to adjust your parking spot location"
      data-testid="leaver-map-picker"
      data-layout="fill"
      data-map-shell="stable"
      data-loading="chunk"
    >
      <MapLoadingState />
    </div>
  );
}

const SpotLocationPickerClient = dynamic(
  () =>
    loadMapLibreModule().then(() =>
      import("@/components/spots/SpotLocationPickerMapLibre").then(
        (mod) => mod.SpotLocationPicker,
      ),
    ),
  {
    ssr: false,
    loading: () => <SpotLocationPickerChunkLoading />,
  },
);

type SpotLocationPickerLoaderProps = ComponentProps<typeof SpotLocationPicker>;

export function SpotLocationPickerLoader(props: SpotLocationPickerLoaderProps) {
  return <SpotLocationPickerClient {...props} />;
}
