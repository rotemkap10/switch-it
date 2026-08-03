"use client";

import type { ReactNode } from "react";

import { ModeChooser } from "@/components/mode/ModeChooser";
import { useMode } from "@/components/mode/ModeProvider";

type ModeGateProps = {
  children: ReactNode;
};

export function ModeGate({ children }: ModeGateProps) {
  const { mode, ready } = useMode();

  if (!ready) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!mode) {
    return <ModeChooser />;
  }

  return <>{children}</>;
}
