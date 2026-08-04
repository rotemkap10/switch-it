"use client";

import dynamic from "next/dynamic";

import type { ComponentProps } from "react";

import { MapLoadingState } from "@/components/map/MapLoadingState";
import type { SpotLocationPicker } from "@/components/spots/SpotLocationPickerMapLibre";
import { LEAVER_MAP_SHELL_HEIGHT_CLASS } from "@/lib/map/leaverMapShell";

const SpotLocationPickerClient = dynamic(
  () =>
    import("@/components/spots/SpotLocationPickerMapLibre").then(
      (mod) => mod.SpotLocationPicker,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className={[
          "w-full overflow-hidden",
          "rounded-[var(--radius-card)] border border-border",
          LEAVER_MAP_SHELL_HEIGHT_CLASS,
        ].join(" ")}
        aria-label="Map to adjust your parking spot location"
      >
        <MapLoadingState />
      </div>
    ),
  },
);

type SpotLocationPickerLoaderProps = ComponentProps<typeof SpotLocationPicker>;

export function SpotLocationPickerLoader(props: SpotLocationPickerLoaderProps) {
  return <SpotLocationPickerClient {...props} />;
}
