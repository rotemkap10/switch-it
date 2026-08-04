import { getRTLTextPluginStatus, setRTLTextPlugin } from "maplibre-gl";

/** Self-hosted Mapbox RTL text plugin (required for Hebrew with maplibre-gl). */
export const MAPLIBRE_RTL_PLUGIN_URL = "/maplibre/mapbox-gl-rtl-text.js";

/**
 * Register the RTL text plugin once. Lazy-load until Hebrew/Arabic glyphs appear.
 * Does not install or require the MapTiler SDK.
 */
export function configureMapLibreRtlPlugin(): void {
  if (typeof window === "undefined") {
    return;
  }

  const status = getRTLTextPluginStatus();
  if (status !== "unavailable") {
    return;
  }

  void setRTLTextPlugin(MAPLIBRE_RTL_PLUGIN_URL, true).catch(() => {
    if (process.env.NODE_ENV === "development") {
      console.warn("[map] Failed to load MapLibre RTL text plugin");
    }
  });
}
