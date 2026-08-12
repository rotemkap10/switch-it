"use client";

import { useLayoutEffect } from "react";

import { syncSafeAreaInsetCssVars } from "@/lib/native/safe-area";
import { configureNativeStatusBar } from "@/lib/native/status-bar";

/**
 * Keeps `--app-safe-*` tokens aligned after rotation/resizes.
 * On native iOS, configures StatusBar so the WebView does not overlay the
 * system status bar, then re-syncs safe-area tokens (top inset owned natively).
 * Initial sync runs from `safeAreaBootstrapScript()` before hydration.
 */
export function SafeAreaInsetsSync() {
  useLayoutEffect(() => {
    let cancelled = false;

    syncSafeAreaInsetCssVars();

    void (async () => {
      await configureNativeStatusBar();
      if (!cancelled) {
        syncSafeAreaInsetCssVars();
      }
    })();

    const resync = () => {
      syncSafeAreaInsetCssVars();
    };

    window.addEventListener("resize", resync);
    window.addEventListener("orientationchange", resync);
    window.visualViewport?.addEventListener("resize", resync);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resync);
      window.removeEventListener("orientationchange", resync);
      window.visualViewport?.removeEventListener("resize", resync);
    };
  }, []);

  return null;
}
