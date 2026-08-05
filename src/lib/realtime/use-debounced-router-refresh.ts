"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

const DEFAULT_DEBOUNCE_MS = 250;

/**
 * Coalesce Realtime bursts into one router.refresh().
 * Does not recreate MapLibre by itself — RSC props update in place.
 */
export function useDebouncedRouterRefresh(debounceMs = DEFAULT_DEBOUNCE_MS) {
  const router = useRouter();
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef(false);

  const flush = useCallback(() => {
    timerRef.current = null;
    if (!pendingRef.current) {
      return;
    }
    pendingRef.current = false;
    router.refresh();
  }, [router]);

  const scheduleRefresh = useCallback(() => {
    pendingRef.current = true;
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(flush, debounceMs);
  }, [debounceMs, flush]);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return scheduleRefresh;
}

export { DEFAULT_DEBOUNCE_MS as REALTIME_REFRESH_DEBOUNCE_MS };
