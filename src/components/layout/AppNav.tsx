"use client";

import { ModeHomeLink, ModeSwitch } from "@/components/mode/ModeSwitch";
import { ProfileMenu } from "@/components/layout/ProfileMenu";

type AppNavProps = {
  /** Tighter map chrome; header still hosts the mode switch. */
  compact?: boolean;
  displayName?: string | null;
};

export function AppNav({ compact = false, displayName = null }: AppNavProps) {
  return (
    <header
      className={[
        "z-40 border-b border-border/80 bg-surface/95 shadow-[var(--shadow-card)] backdrop-blur-sm",
        compact ? "shrink-0" : "",
      ].join(" ")}
      data-testid="app-nav"
    >
      <div
        className={[
          "mx-auto flex w-full flex-col gap-2.5 px-4 sm:px-6",
          compact ? "max-w-none py-2.5" : "max-w-5xl py-3",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ModeHomeLink className="shrink-0 text-lg font-semibold tracking-tight text-foreground transition-colors duration-[var(--motion-fast)] hover:text-accent-hover">
              Switch It
            </ModeHomeLink>
            <div className="hidden md:block">
              <ModeSwitch />
            </div>
          </div>
          <ProfileMenu displayName={displayName} />
        </div>

        <div className="md:hidden">
          <ModeSwitch fullWidth />
        </div>
      </div>
    </header>
  );
}
