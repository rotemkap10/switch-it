/**
 * Prefetch helpers for the two primary authenticated modes.
 */

export const CORE_MODE_ROUTES = ["/map", "/spots/new"] as const;

export type CoreModeRoute = (typeof CORE_MODE_ROUTES)[number];

const prefetched = new Set<string>();

export function shouldDeferRoutePrefetch(options: {
  saveData?: boolean;
  ready: boolean;
}): boolean {
  return !options.ready || options.saveData === true;
}

export function shouldPrefetchRoute(href: string): boolean {
  return !prefetched.has(href);
}

export function markRoutePrefetched(href: string): void {
  prefetched.add(href);
}

export function readPrefetchSaveData(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean };
    }
  ).connection;
  return connection?.saveData === true;
}

/** Test helper */
export function resetRoutePrefetchState(): void {
  prefetched.clear();
}

export function scheduleIdle(task: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const ric = (
    window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    }
  ).requestIdleCallback;

  if (typeof ric === "function") {
    const id = ric(task, { timeout: 2500 });
    return () => {
      window.cancelIdleCallback?.(id);
    };
  }

  const timer = window.setTimeout(task, 400);
  return () => window.clearTimeout(timer);
}
