"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { Button } from "@/components/ui/Button";

const links = [
  { href: "/map", label: "Map" },
  { href: "/spots/new", label: "Publish Spot" },
  { href: "/profile", label: "Profile" },
  { href: "/history", label: "History" },
] as const;

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
      className={`rounded-lg px-3 py-2 text-sm font-medium ${
        active
          ? "bg-accent-soft text-accent"
          : "text-foreground hover:bg-accent-soft"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}

export function AppNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/map" className="text-lg font-semibold tracking-tight text-foreground">
          Switch It
        </Link>

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
          className="border-t border-border px-4 py-3 md:hidden"
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
