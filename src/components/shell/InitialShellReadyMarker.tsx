"use client";

import { useEffect } from "react";

import { useReportInitialShellReady } from "@/components/shell/AppLaunchReadyContext";

/**
 * Signals that the first real application shell has mounted
 * (auth chrome, auth/onboarding page, logged-out landing, or offline).
 *
 * Do NOT mount this during auth-routing placeholders (e.g. `/` while
 * getSession is unresolved) — that releases the branded splash into a blank
 * screen before `/map` can await the first map frame.
 * Not used by loading.tsx fallbacks.
 */
export function InitialShellReadyMarker() {
  const report = useReportInitialShellReady();

  useEffect(() => {
    report();
  }, [report]);

  return null;
}
