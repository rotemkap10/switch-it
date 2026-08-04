"use client";

import dynamic from "next/dynamic";

import type { ComponentProps } from "react";

import type { SpotLocationPicker } from "@/components/spots/SpotLocationPicker";

const SpotLocationPickerClient = dynamic(
  () =>
    import("@/components/spots/SpotLocationPicker").then(
      (mod) => mod.SpotLocationPicker,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-[250px] items-center justify-center rounded-[var(--radius-card)] border border-border bg-accent-soft text-sm text-muted"
        role="status"
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
