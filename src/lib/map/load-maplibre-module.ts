/**
 * Shared MapLibre module loader.
 * Concurrent map components reuse one dynamic-import promise.
 * A failed import is not cached so a later retry (or stale-build reload)
 * can succeed.
 */
type MapLibreModule = typeof import("maplibre-gl");

let mapLibreImporter: () => Promise<MapLibreModule> = () =>
  import("maplibre-gl");
let mapLibrePromise: Promise<MapLibreModule> | null = null;

export function loadMapLibreModule(): Promise<MapLibreModule> {
  if (!mapLibrePromise) {
    mapLibrePromise = mapLibreImporter().catch((error: unknown) => {
      mapLibrePromise = null;
      throw error;
    });
  }
  return mapLibrePromise;
}

/** Test helper — reset the shared promise between suites. */
export function resetMapLibreModuleLoader(): void {
  mapLibrePromise = null;
}

/** Test helper — inject a fake importer. Pass null to restore. */
export function setMapLibreModuleImporterForTests(
  importer: (() => Promise<MapLibreModule>) | null,
): void {
  mapLibrePromise = null;
  mapLibreImporter = importer ?? (() => import("maplibre-gl"));
}
