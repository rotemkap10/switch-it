import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * Native MapLibre AttributionControl options.
 *
 * MapLibre 6 still *starts* compact attribution expanded (`maplibregl-compact-show`)
 * and only collapses it on drag. `compact: true` is required so every map width
 * uses the ⓘ control instead of always-on full text.
 */
export const MAP_ATTRIBUTION_CONTROL_OPTIONS = {
  compact: true,
} as const;

const ATTRIBUTION_SELECTOR = ".maplibregl-ctrl-attrib";
const ATTRIBUTION_READY_EVENTS = ["load", "styledata", "sourcedata"] as const;

/**
 * Collapse the native compact attribution control the same way MapLibre does
 * on drag: remove `maplibregl-compact-show`. Does not hide or remove the control.
 */
export function collapseMapLibreAttribution(
  root: ParentNode | null | undefined,
): boolean {
  if (!root) {
    return false;
  }

  const attrib = root.querySelector(ATTRIBUTION_SELECTOR);
  if (!(attrib instanceof HTMLElement)) {
    return false;
  }

  if (attrib.classList.contains("maplibregl-attrib-empty")) {
    return false;
  }

  if (!attrib.classList.contains("maplibregl-compact")) {
    return false;
  }

  attrib.classList.remove("maplibregl-compact-show");
  return true;
}

/**
 * Collapse attribution once the native control is present, then stop listening
 * so a later user tap can expand it. Style/source updates that first attach
 * compact attribution still get collapsed; later events do not re-collapse.
 */
export function keepMapLibreAttributionInitiallyCollapsed(
  map: MapLibreMap,
): () => void {
  const tryCollapse = () => {
    if (!collapseMapLibreAttribution(map.getContainer())) {
      return;
    }

    for (const event of ATTRIBUTION_READY_EVENTS) {
      map.off(event, tryCollapse);
    }
  };

  tryCollapse();
  for (const event of ATTRIBUTION_READY_EVENTS) {
    map.on(event, tryCollapse);
  }

  return () => {
    for (const event of ATTRIBUTION_READY_EVENTS) {
      map.off(event, tryCollapse);
    }
  };
}
