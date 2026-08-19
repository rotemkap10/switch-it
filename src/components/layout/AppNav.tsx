"use client";

import { Logo } from "@/components/branding/Logo";
import { AppShellHeaderInner } from "@/components/layout/AppShellHeaderInner";
import { ModeHomeLink, ModeSwitch } from "@/components/mode/ModeSwitch";
import { ProfileMenu } from "@/components/layout/ProfileMenu";

type AppNavProps = {
  /** Map routes: header stays out of the flex shrink of the map stage. */
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
      <AppShellHeaderInner>
        <div
          className="flex items-center justify-between gap-3"
          data-testid="app-nav-row-brand"
        >
          <div className="flex min-w-0 items-center gap-3">
            <ModeHomeLink
              aria-label="Switch It"
              className="inline-flex shrink-0 items-center transition-opacity duration-[var(--motion-fast)] hover:opacity-90"
            >
              <Logo variant="nav" decorative />
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
      </AppShellHeaderInner>
    </header>
  );
}
