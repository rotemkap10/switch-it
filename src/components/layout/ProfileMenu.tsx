"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { logout } from "@/actions/auth";
import { InstallAppSheet } from "@/components/pwa/InstallAppSheet";
import { UserInitialAvatar } from "@/components/illustrations/UserInitialAvatar";
import { usePwaInstall } from "@/lib/pwa/use-pwa-install";
import { useOneShotAnimation } from "@/lib/motion/use-one-shot-animation";

type ProfileMenuProps = {
  displayName?: string | null;
};

export function ProfileMenu({ displayName }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const trimmedName = displayName?.trim() || null;
  const avatarEntrance = useOneShotAnimation("nav-avatar-entrance");
  const {
    showInstallEntry,
    requestInstallUi,
    iosSheetOpen,
    closeIosSheet,
  } = usePwaInstall();

  function closeMenu() {
    setOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <div ref={rootRef} className="relative" data-testid="profile-menu">
        <button
          ref={triggerRef}
          type="button"
          className={[
            "inline-flex max-w-[10rem] items-center gap-2 rounded-[var(--radius-card)] border border-border bg-surface px-2.5",
            "min-h-[var(--app-tap-min)] text-sm font-medium text-foreground motion-interactive-press",
            "hover:bg-accent-soft transition-colors duration-[var(--motion-fast)]",
          ].join(" ")}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={
            trimmedName ? `Profile menu for ${trimmedName}` : "Profile menu"
          }
          onClick={() => setOpen((value) => !value)}
        >
          <UserInitialAvatar
            name={trimmedName}
            animateEntrance={avatarEntrance}
            size="sm"
          />
          {trimmedName ? (
            <span className="hidden truncate md:inline" aria-hidden="true">
              {trimmedName}
            </span>
          ) : null}
        </button>

        {open ? (
          <div
            id={menuId}
            role="menu"
            aria-label="Profile"
            className="absolute right-0 z-50 mt-2 min-w-[10.5rem] overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface py-1 shadow-[var(--shadow-card)] motion-fade-slide-down"
          >
            <Link
              href="/profile"
              role="menuitem"
              className="block min-h-[var(--app-tap-min)] px-3 py-2.5 text-sm text-foreground hover:bg-accent-soft"
              onClick={() => closeMenu()}
            >
              Profile
            </Link>
            {showInstallEntry ? (
              <button
                type="button"
                role="menuitem"
                className="block min-h-[var(--app-tap-min)] w-full px-3 py-2.5 text-left text-sm text-foreground hover:bg-accent-soft"
                onClick={() => {
                  closeMenu();
                  void requestInstallUi();
                }}
              >
                Install app
              </button>
            ) : null}
            <form action={logout} role="none">
              <button
                type="submit"
                role="menuitem"
                className="block min-h-[var(--app-tap-min)] w-full px-3 py-2.5 text-left text-sm text-foreground hover:bg-accent-soft"
              >
                Log out
              </button>
            </form>
          </div>
        ) : null}
      </div>

      <InstallAppSheet
        open={iosSheetOpen}
        onClose={closeIosSheet}
        returnFocusRef={triggerRef}
      />
    </>
  );
}
