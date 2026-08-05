/**
 * Shared MapLibre module loader.
 * Concurrent map components reuse one dynamic-import promise.
 */
type MapLibreModule = typeof import("maplibre-gl");

let mapLibrePromise: Promise<MapLibreModule> | null = null;

export function loadMapLibreModule(): Promise<MapLibreModule> {
  if (!mapLibrePromise) {
    mapLibrePromise = import("maplibre-gl");
  }
  return mapLibrePromise;
}

/** Test helper — reset the shared promise between suites. */
export function resetMapLibreModuleLoader(): void {
  mapLibrePromise = null;
}
