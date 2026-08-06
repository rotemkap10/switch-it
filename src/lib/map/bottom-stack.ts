/**
 * Shared seeker-map bottom overlay stack (Phase 2).
 * CSS variables on [data-map-bottom] drive control/carousel/toast clearance.
 * No runtime measurement — values are token-based.
 */

export type MapBottomStack =
  | "none"
  | "carousel"
  | "selected"
  | "claim-collapsed"
  | "claim-expanded";

export function resolveDiscoveryBottomStack(options: {
  hasSpots: boolean;
  hasSelected: boolean;
}): MapBottomStack {
  if (options.hasSelected) {
    return "selected";
  }
  if (options.hasSpots) {
    return "carousel";
  }
  return "none";
}

/**
 * Syncs bottom-stack onto the document element so fixed toasts inherit
 * clearance tokens. Local map shells also set data-map-bottom for controls.
 */
export function syncDocumentMapBottomStack(stack: MapBottomStack | null) {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  if (!stack || stack === "none") {
    delete root.dataset.mapBottom;
    return;
  }
  root.dataset.mapBottom = stack;
}

/** Class applied to floating map controls (recenter, location pills). */
export const MAP_FLOATING_CONTROL_CLASS = "map-floating-control";

/** Class for discovery carousel root. */
export const MAP_CAROUSEL_CLASS = "map-carousel";

/** Class for selected-spot / claim sheet shells. */
export const MAP_SHEET_CLASS = "map-bottom-sheet";

export const MAP_SHEET_HOST_CLASS = "map-bottom-sheet-host";
