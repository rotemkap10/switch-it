"use client";

import type { ReactNode } from "react";

import { useMode } from "@/components/mode/ModeProvider";

type ModeGateProps = {
  children: ReactNode;
};

/**
 * Waits for mode preference hydration. Route is authoritative for the
 * selected mode — no first-run Looking/Leaving chooser.
 */
export function ModeGate({ children }: ModeGateProps) {
  const { ready } = useMode();

  if (!ready) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
