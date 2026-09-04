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
  /** Highlights the mode-switch skeleton on phone. `none` = secondary pages. */
  mode?: "seeker" | "publisher" | "none";
};

/**
 * Static header geometry for route loading chrome.
 * Matches AppNav spacing so the logo does not jump when the page hydrates.
 */
export function AppShellHeaderLoadingPlaceholder({
  mode = "none",
}: AppShellHeaderLoadingPlaceholderProps) {
  const showPill = mode !== "none";

  return (
    <AppShellHeaderInner>
      <div className="flex items-center justify-between gap-3">
        <Logo variant="nav" decorative />
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className="inline-flex h-8 items-center gap-1.5 px-1"
            aria-hidden="true"
            data-testid="header-credits-loading-placeholder"
          >
            <span className="h-6 w-6 shrink-0 rounded-full bg-accent-soft" />
            <span className="h-4 w-6 rounded-sm bg-accent-soft" />
          </span>
          <div
            className="h-[var(--app-tap-min)] w-[var(--app-tap-min)] shrink-0 rounded-[var(--radius-card)] border border-border bg-accent-soft"
            aria-hidden="true"
          />
        </div>
      </div>
      <div
        className="relative flex h-[var(--app-tap-min)] w-full items-center rounded-[var(--radius-card)] border border-border bg-accent-soft p-0.5 md:hidden"
        aria-hidden="true"
        data-mode={mode}
      >
        {showPill ? (
          <span
            className={[
              "absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-[calc(var(--radius-card)-2px)] bg-accent shadow-sm",
              mode === "publisher" ? "translate-x-full" : "",
            ].join(" ")}
            data-testid="header-loading-mode-pill"
          />
        ) : null}
        <span
          className={[
            "relative z-[1] flex flex-1 items-center justify-center text-xs font-semibold",
            mode === "seeker" ? "text-foreground" : "text-muted",
          ].join(" ")}
        >
          Find parking
        </span>
        <span
          className={[
            "relative z-[1] flex flex-1 items-center justify-center text-xs font-semibold",
            mode === "publisher" ? "text-foreground" : "text-muted",
          ].join(" ")}
        >
          Share a spot
        </span>
      </div>
    </AppShellHeaderInner>
  );
}
