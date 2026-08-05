/**
 * Opt-in MapLibre load timeline marks (development only).
 *
 * Enable with: localStorage.setItem("switch-it:map-perf", "1")
 * Never records API keys, style URLs with credentials, coords, or user ids.
 */

const PERF_FLAG = "switch-it:map-perf";

export function isMapPerfEnabled(): boolean {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }
  try {
    return window.localStorage.getItem(PERF_FLAG) === "1";
  } catch {
    return false;
  }
}

export function mapPerfMark(name: string): void {
  if (!isMapPerfEnabled() || typeof performance === "undefined") {
    return;
  }
  try {
    performance.mark(name);
  } catch {
    // Ignore quota / invalid mark names.
  }
}

export function mapPerfMeasure(
  name: string,
  startMark: string,
  endMark: string,
): void {
  if (!isMapPerfEnabled() || typeof performance === "undefined") {
    return;
  }
  try {
    performance.measure(name, startMark, endMark);
    const entries = performance.getEntriesByName(name, "measure");
    const last = entries[entries.length - 1];
    if (last) {
      console.info("[map-perf]", name, `${Math.round(last.duration)}ms`);
    }
  } catch {
    // Start mark may be missing if lifecycle aborted.
  }
}
