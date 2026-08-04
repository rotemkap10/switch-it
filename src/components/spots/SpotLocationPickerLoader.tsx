"use client";

import dynamic from "next/dynamic";

import type { ComponentProps } from "react";

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
          "flex w-full items-center justify-center",
          "rounded-[var(--radius-card)] border border-border bg-accent-soft",
          "text-sm text-muted",
          LEAVER_MAP_SHELL_HEIGHT_CLASS,
        ].join(" ")}
        role="status"
        aria-label="Map to adjust your parking spot location"
      >
        Loading map…
      </div>
    ),
  },
);

type SpotLocationPickerLoaderProps = ComponentProps<typeof SpotLocationPicker>;

export function SpotLocationPickerLoader(props: SpotLocationPickerLoaderProps) {
  return <SpotLocationPickerClient {...props} />;
}
