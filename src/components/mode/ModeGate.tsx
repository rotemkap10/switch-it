"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import {
  useReportInitialShellReady,
  useRequestAwaitInitialMap,
} from "@/components/shell/AppLaunchReadyContext";
import { useMode } from "@/components/mode/ModeProvider";

type ModeGateProps = {
  children: ReactNode;
};

/**
 * Waits for mode preference hydration. Route is authoritative for the
 * selected mode — no first-run Looking/Leaving chooser.
 *
 * Cold launch to /map: request that splash wait for the first usable map
 * frame before exiting (shell chrome alone is not enough).
 */
export function ModeGate({ children }: ModeGateProps) {
  const { ready } = useMode();
  const pathname = usePathname();
  const reportShellReady = useReportInitialShellReady();
  const requestAwaitInitialMap = useRequestAwaitInitialMap();

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (pathname === "/map") {
      requestAwaitInitialMap();
    }
    reportShellReady();
  }, [ready, pathname, requestAwaitInitialMap, reportShellReady]);

  if (!ready) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
