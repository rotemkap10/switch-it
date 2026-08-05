"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useMode } from "@/components/mode/ModeProvider";
import {
  MODE_OPTIONS,
  modeFromPathname,
  type AppMode,
} from "@/lib/mode/constants";

type ModeSwitchProps = {
  /** Stretch to full width (mobile header row). */
  fullWidth?: boolean;
};

export function ModeSwitch({ fullWidth = false }: ModeSwitchProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, setMode, ready } = useMode();

  const routeMode = modeFromPathname(pathname);
  const selected: AppMode = routeMode ?? mode ?? "seeker";
  const activeIndex = MODE_OPTIONS.findIndex(
    (option) => option.mode === selected,
  );

  // Keep localStorage aligned as a secondary convenience; route wins.
  useEffect(() => {
    if (!ready || !routeMode || routeMode === mode) {
      return;
    }
    setMode(routeMode);
  }, [ready, routeMode, mode, setMode]);

  function switchTo(next: AppMode, href: string) {
    setMode(next);
    if (routeMode === next) {
      return;
    }
    router.push(href);
  }

  return (
    <div
      className={[
        "relative inline-flex rounded-[var(--radius-card)] border border-border bg-accent-soft p-0.5",
        fullWidth ? "w-full" : "",
      ].join(" ")}
      role="tablist"
      aria-label="App mode"
      data-testid="mode-switch"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-[calc(var(--radius-card)-2px)] bg-accent shadow-sm motion-mode-pill"
        style={{
          transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
        }}
      />
      {MODE_OPTIONS.map((option) => {
        const active = option.mode === selected;
        return (
          <button
            key={option.mode}
            type="button"
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            onClick={() => switchTo(option.mode, option.href)}
            className={[
              "relative z-[1] flex flex-1 items-center justify-center whitespace-nowrap rounded-[calc(var(--radius-card)-2px)] px-2.5 text-xs font-semibold sm:px-3 sm:text-sm",
              "motion-interactive-press transition-colors duration-[var(--motion-standard)]",
              fullWidth
                ? "min-h-[var(--app-tap-min)] min-w-0 py-2"
                : "min-h-9 min-w-[6.75rem] py-1.5",
              active ? "text-foreground" : "text-muted hover:text-foreground",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Brand home follows the route-selected mode (fallback: stored / map). */
export function useModeBrandHref(): string {
  const pathname = usePathname();
  const { mode, homeFor } = useMode();
  const routeMode = modeFromPathname(pathname);
  return homeFor(routeMode ?? mode ?? "seeker");
}

export function ModeHomeLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const href = useModeBrandHref();
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
