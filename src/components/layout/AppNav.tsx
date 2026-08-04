"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { ModeSwitcher } from "@/components/mode/ModeSwitcher";
import { useMode } from "@/components/mode/ModeProvider";
import { Button } from "@/components/ui/Button";
import type { AppMode } from "@/lib/mode/constants";

const linksByMode: Record<AppMode, ReadonlyArray<{ href: string; label: string }>> =
  {
    seeker: [
      { href: "/map", label: "Find parking" },
      { href: "/profile", label: "Profile" },
    ],
    leaver: [
      { href: "/spots/new", label: "My parking spot" },
      { href: "/profile", label: "Profile" },
    ],
  };

function NavLink({
  href,
  label,
  onNavigate,
}: {
  href: string;
  label: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

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

export function AppNav() {
  const [open, setOpen] = useState(false);
  const { mode, homeFor } = useMode();
  const links = mode ? linksByMode[mode] : [];
  const brandHref = mode ? homeFor(mode) : "/map";

  return (
    <header className="border-b border-border/80 bg-surface/95 shadow-[var(--shadow-card)] backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
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

        <Button
          type="button"
          variant="secondary"
          className="md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "Menu"}
        </Button>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          className="motion-fade-slide-down border-t border-border px-4 py-3 md:hidden"
          aria-label="Mobile"
        >
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-1">
            {links.map((link) => (
              <NavLink
                key={link.href}
                {...link}
                onNavigate={() => setOpen(false)}
              />
            ))}
            <div className="pt-2">
              <LogoutButton />
            </div>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
