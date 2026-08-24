"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { modeFromPathname } from "@/lib/mode/constants";

const MODE_ENTER_CLASS =
  "flex min-h-0 flex-1 flex-col motion-mode-content";
const SECONDARY_ENTER_CLASS =
  "flex min-h-0 flex-1 flex-col motion-page-enter";

/**
 * Deterministic enter animation for authenticated main content.
 *
 * Primary map modes keep the existing mode-switch enter class, keyed by mode.
 * Secondary routes key by pathname so the first client navigation (e.g. Profile)
 * remounts and always plays the page-enter animation.
 */
export function SecondaryPageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const routeMode = modeFromPathname(pathname);

  if (routeMode) {
    return (
      <div
        key={routeMode}
        className={MODE_ENTER_CLASS}
        data-testid="mode-page-transition"
      >
        {children}
      </div>
    );
  }

  return (
    <div
      key={pathname}
      className={SECONDARY_ENTER_CLASS}
      data-testid="secondary-page-transition"
      data-pathname={pathname}
    >
      {children}
    </div>
  );
}
