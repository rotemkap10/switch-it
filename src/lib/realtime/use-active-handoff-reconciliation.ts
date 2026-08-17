"use client";

import { useEffect } from "react";

import { useDebouncedRouterRefresh } from "@/lib/realtime/use-debounced-router-refresh";

/** Reconciliation poll while an active handoff is open (Realtime is primary). */
export const ACTIVE_HANDOFF_RECONCILE_MS = 8_000;

/**
 * Keeps active handoff UI fresh when Realtime events are missed
 * (backgrounded WebView, brief disconnect). Visibility restore + short poll.
 * Does not replace Realtime — only reconciles.
 */
export function useActiveHandoffReconciliation(enabled: boolean): void {
  const scheduleRefresh = useDebouncedRouterRefresh();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function refreshIfVisible() {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
      }
    }

    function handleOnline() {
      scheduleRefresh();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    const intervalId = window.setInterval(
      refreshIfVisible,
      ACTIVE_HANDOFF_RECONCILE_MS,
    );

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.clearInterval(intervalId);
    };
  }, [enabled, scheduleRefresh]);
}
