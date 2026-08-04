"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { ModeSwitcher } from "@/components/mode/ModeSwitcher";
import { useMode } from "@/components/mode/ModeProvider";
import type { AppMode } from "@/lib/mode/constants";

export const linksByMode: Record<
  AppMode,
  ReadonlyArray<{ href: string; label: string }>
> = {
  seeker: [
    { href: "/map", label: "Find parking" },
    { href: "/profile", label: "Profile" },
  ],
  leaver: [
    { href: "/spots/new", label: "My spot" },
    { href: "/profile", label: "Profile" },
  ],
};

function NavLink({
  href,
  label,
  onNavigate,
  variant = "header",
}: {
  href: string;
  label: string;
  onNavigate?: () => void;
  variant?: "header" | "tab";
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  if (variant === "tab") {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        className={[
          "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 text-xs font-semibold",
          "motion-interactive-press transition-colors duration-[var(--motion-fast)]",
          active ? "text-accent-hover" : "text-muted hover:text-foreground",
        ].join(" ")}
        aria-current={active ? "page" : undefined}
      >
        <span
          className={[
            "h-1 w-8 rounded-full transition-colors duration-[var(--motion-fast)]",
            active ? "bg-accent" : "bg-transparent",
          ].join(" ")}
          aria-hidden="true"
        />
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={[
        "rounded-lg px-3 py-2 text-sm font-medium motion-interactive-press",
        "transition-[color,background-color,border-color] duration-[var(--motion-standard)]",
        active
          ? "bg-accent text-foreground"
          : "text-foreground hover:bg-accent-soft",
      ].join(" ")}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}

type AppNavProps = {
  /** Tighter header for map-first screens; enables mobile bottom tabs. */
  compact?: boolean;
};

export function AppNav({ compact = false }: AppNavProps) {
  const { mode, homeFor } = useMode();
  const links = mode ? linksByMode[mode] : [];
  const brandHref = mode ? homeFor(mode) : "/map";

  return (
    <>
      <header
        className={[
          "z-40 border-b border-border/80 bg-surface/95 shadow-[var(--shadow-card)] backdrop-blur-sm",
          compact ? "shrink-0" : "",
        ].join(" ")}
      >
        <div
          className={[
            "mx-auto flex w-full items-center justify-between gap-3 px-4 sm:px-6",
            compact ? "max-w-none py-2.5" : "max-w-5xl py-3",
          ].join(" ")}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={brandHref}
              className="text-lg font-semibold tracking-tight text-foreground transition-colors duration-[var(--motion-fast)] hover:text-accent-hover"
            >
              Switch It
            </Link>
            <ModeSwitcher />
          </div>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {links.map((link) => (
              <NavLink key={link.href} {...link} />
            ))}
            <LogoutButton />
          </nav>

          <div className="md:hidden">
            <LogoutButton />
          </div>
        </div>
      </header>

      {links.length > 0 ? (
        <nav
          className={[
            "fixed inset-x-0 bottom-0 z-40 md:hidden",
            "border-t border-border/80 bg-surface/95 shadow-[0_-4px_16px_rgb(18_50_74/0.08)] backdrop-blur-sm",
            "pb-[env(safe-area-inset-bottom,0px)]",
          ].join(" ")}
          style={{ minHeight: "var(--app-bottom-nav-height)" }}
          aria-label="Mobile"
        >
          <div className="mx-auto flex w-full max-w-lg items-stretch">
            {links.map((link) => (
              <NavLink key={link.href} {...link} variant="tab" />
            ))}
          </div>
        </nav>
      ) : null}
    </>
  );
}
