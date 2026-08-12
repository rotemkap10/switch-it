"use client";

import { useLayoutEffect } from "react";

import { syncSafeAreaInsetCssVars } from "@/lib/native/safe-area";

/**
 * Keeps `--app-safe-*` tokens aligned after rotation/resizes.
 * Initial sync runs from `safeAreaBootstrapScript()` before hydration.
 */
export function SafeAreaInsetsSync() {
  useLayoutEffect(() => {
    syncSafeAreaInsetCssVars();

    const resync = () => {
      syncSafeAreaInsetCssVars();
    };

    window.addEventListener("resize", resync);
    window.addEventListener("orientationchange", resync);
    window.visualViewport?.addEventListener("resize", resync);

    return () => {
      window.removeEventListener("resize", resync);
      window.removeEventListener("orientationchange", resync);
      window.visualViewport?.removeEventListener("resize", resync);
    };
  }, []);

  return null;
}
