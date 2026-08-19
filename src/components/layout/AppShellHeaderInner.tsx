import type { ReactNode } from "react";

import { Logo } from "@/components/branding/Logo";

/** Full-width authenticated header inner — never follow page content max-width. */
export const APP_SHELL_HEADER_INNER_CLASS = "app-shell-header-inner";

export function AppShellHeaderInner({ children }: { children: ReactNode }) {
  return (
    <div
      className={APP_SHELL_HEADER_INNER_CLASS}
      data-testid="app-shell-header-inner"
    >
      {children}
    </div>
  );
}

type AppShellHeaderLoadingPlaceholderProps = {
  /** Highlights the mode-switch skeleton on phone. */
  mode?: "seeker" | "publisher";
};

/**
 * Static header geometry for route loading chrome.
 * Matches AppNav spacing so the logo does not jump when the page hydrates.
 */
export function AppShellHeaderLoadingPlaceholder({
  mode = "seeker",
}: AppShellHeaderLoadingPlaceholderProps) {
  return (
    <AppShellHeaderInner>
      <div className="flex items-center justify-between gap-3">
        <Logo variant="nav" decorative />
        <div
          className="h-[var(--app-tap-min)] w-[var(--app-tap-min)] shrink-0 rounded-[var(--radius-card)] border border-border bg-accent-soft"
          aria-hidden="true"
        />
      </div>
      <div
        className="relative flex h-[var(--app-tap-min)] w-full items-center rounded-[var(--radius-card)] border border-border bg-accent-soft p-0.5 md:hidden"
        aria-hidden="true"
      >
        <span
          className={[
            "absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-[calc(var(--radius-card)-2px)] bg-accent shadow-sm",
            mode === "publisher" ? "translate-x-full" : "",
          ].join(" ")}
        />
        <span className="relative z-[1] flex flex-1 items-center justify-center text-xs font-semibold text-foreground">
          Find parking
        </span>
        <span className="relative z-[1] flex flex-1 items-center justify-center text-xs font-semibold text-muted">
          Share a spot
        </span>
      </div>
    </AppShellHeaderInner>
  );
}
