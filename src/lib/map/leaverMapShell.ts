/** Stable leaver picker shell height (skeleton + live map share this). */
export const LEAVER_MAP_SHELL_HEIGHT_CLASS = "leaver-map-picker-shell";

/** Tailwind `sm` — Share a Spot shows MapLibre +/- zoom at this breakpoint and up. */
export const LEAVER_MAP_ZOOM_CONTROLS_MEDIA_QUERY = "(min-width: 640px)";

/** Desktop-only MapLibre +/- zoom for the leaver location picker (pinch/wheel zoom stays on). */
export function shouldShowLeaverMapZoomControls(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(LEAVER_MAP_ZOOM_CONTROLS_MEDIA_QUERY).matches;
}

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
