/** Stable leaver picker shell height (skeleton + live map share this). */
export const LEAVER_MAP_SHELL_HEIGHT_CLASS = "leaver-map-picker-shell";

export type PublisherPreviewVariant = "available" | "claimed" | "handoff";

export function publisherPreviewShellClass(
  variant: PublisherPreviewVariant = "available",
): string {
  if (variant === "claimed") {
    return "publisher-preview-map-shell publisher-preview-map-shell--claimed";
  }
  if (variant === "handoff") {
    return "publisher-preview-map-shell publisher-preview-map-shell--handoff";
  }
  return "publisher-preview-map-shell publisher-preview-map-shell--available";
}

/** @deprecated Use publisherPreviewShellClass */
export const PUBLISHER_PREVIEW_HEIGHT_CLASS = publisherPreviewShellClass("available");
