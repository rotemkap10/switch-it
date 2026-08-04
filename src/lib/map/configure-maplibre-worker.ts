import { setWorkerUrl } from "maplibre-gl";

let configured = false;

/**
 * MapLibre GL JS v6 requires an explicit worker URL when bundled by Next.js/Turbopack.
 * The default import.meta.url resolution points at a hashed chunk path where the
 * worker file does not exist, so the browser receives Next's HTML 404 page.
 */
export function configureMapLibreWorker(): void {
  if (configured || typeof window === "undefined") {
    return;
  }

  configured = true;
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}
