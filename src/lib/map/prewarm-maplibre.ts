import { configureMapLibreWorker } from "@/lib/map/configure-maplibre-worker";
import { loadMapLibreModule } from "@/lib/map/load-maplibre-module";

let prewarmPromise: Promise<void> | null = null;
let prewarmCompleted = false;

/**
 * Dynamically import MapLibre and call official prewarm() once.
 * Does not create a Map instance. Safe to call repeatedly.
 */
export function prewarmMapLibre(): Promise<void> {
  if (prewarmCompleted) {
    return Promise.resolve();
  }
  if (prewarmPromise) {
    return prewarmPromise;
  }
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  prewarmPromise = loadMapLibreModule()
    .then((maplibre) => {
      configureMapLibreWorker();
      if (typeof maplibre.prewarm === "function") {
        maplibre.prewarm();
      }
      prewarmCompleted = true;
    })
    .catch(() => {
      // Non-blocking — map will initialize workers on first Map create.
      prewarmPromise = null;
    });

  return prewarmPromise;
}

export function hasPrewarmedMapLibre(): boolean {
  return prewarmCompleted;
}

/** Test helper */
export function resetMapLibrePrewarmState(): void {
  prewarmPromise = null;
  prewarmCompleted = false;
}
