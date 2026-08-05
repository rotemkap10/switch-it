"use client";

import { ModeHomeLink, ModeSwitch } from "@/components/mode/ModeSwitch";
import { ProfileMenu } from "@/components/layout/ProfileMenu";

type AppNavProps = {
  /** Tighter map chrome; header still hosts the mode switch. */
  compact?: boolean;
  displayName?: string | null;
};

/**
 * Authenticated header.
 * Phones: two rows — brand + profile, then full-width ModeSwitch.
 * Desktop (md+): one row — brand, ModeSwitch, profile.
 */
export function AppNav({ compact = false, displayName = null }: AppNavProps) {
  return (
    <header
      className={[
        "app-shell-header z-40 border-b border-border/80 bg-surface/95 shadow-[var(--shadow-card)] backdrop-blur-sm",
        compact ? "shrink-0" : "",
      ].join(" ")}
      data-testid="app-nav"
    >
      <div
        className={[
          "app-shell-header-inner",
          compact
            ? "app-shell-header-inner--wide"
            : "app-shell-header-inner--contained",
        ].join(" ")}
      >
        <div
          className="flex items-center justify-between gap-3"
          data-testid="app-nav-row-brand"
        >
          <div className="flex min-w-0 items-center gap-3">
            <ModeHomeLink className="shrink-0 text-lg font-semibold tracking-tight text-foreground transition-colors duration-[var(--motion-fast)] hover:text-accent-hover">
              Switch It
            </ModeHomeLink>
            <div className="hidden md:block" data-testid="app-nav-mode-desktop">
              <ModeSwitch />
            </div>
          </div>
          <ProfileMenu displayName={displayName} />
        </div>

        <div className="md:hidden" data-testid="app-nav-row-mode">
          <ModeSwitch fullWidth />
        </div>
      </div>
    </header>
  );
}
