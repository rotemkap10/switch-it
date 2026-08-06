/**
 * Lightweight development performance marks.
 *
 * Enable console reporting with:
 *   localStorage.setItem("switch-it:map-perf", "1")
 *
 * Marks are recorded in development only. Never records user IDs,
 * coordinates, addresses, tokens, or API keys.
 */

const PERF_FLAG = "switch-it:map-perf";

export const PERF_MARKS = {
  navigationStart: "switch-it:navigation-start",
  routeShell: "switch-it:route-shell",
  mapCreated: "switch-it:map-created",
  mapLoad: "switch-it:map-load",
  mapIdle: "switch-it:map-idle",
} as const;

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

function canMark(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    typeof performance !== "undefined"
  );
}

export function mapPerfMark(name: string): void {
  if (!canMark()) {
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

/** Record a navigation-start mark and optionally log. */
export function markNavigationStart(): void {
  mapPerfMark(PERF_MARKS.navigationStart);
  if (isMapPerfEnabled()) {
    console.info("[map-perf]", PERF_MARKS.navigationStart);
  }
}

export function markRouteShell(): void {
  mapPerfMark(PERF_MARKS.routeShell);
  mapPerfMeasure(
    "switch-it:nav-to-shell",
    PERF_MARKS.navigationStart,
    PERF_MARKS.routeShell,
  );
}
