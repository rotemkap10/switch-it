/** Stable leaver picker shell height (skeleton + live map share this). */
export const LEAVER_MAP_SHELL_HEIGHT_CLASS = "leaver-map-picker-shell";

export type PublisherPreviewVariant = "available" | "claimed";

export function publisherPreviewShellClass(
  variant: PublisherPreviewVariant = "available",
): string {
  return variant === "claimed"
    ? "publisher-preview-map-shell publisher-preview-map-shell--claimed"
    : "publisher-preview-map-shell publisher-preview-map-shell--available";
}

/** @deprecated Use publisherPreviewShellClass */
export const PUBLISHER_PREVIEW_HEIGHT_CLASS = publisherPreviewShellClass("available");
