"use client";

import { useEffect } from "react";

import { useReportInitialShellReady } from "@/components/shell/AppLaunchReadyContext";

/**
 * Signals that the first real application shell has mounted
 * (auth chrome, auth/onboarding page, landing, or offline).
 * Not used by loading.tsx fallbacks.
 */
export function InitialShellReadyMarker() {
  const report = useReportInitialShellReady();

  useEffect(() => {
    report();
  }, [report]);

  return null;
}
