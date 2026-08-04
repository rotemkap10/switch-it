"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import {
  buildExternalNavigationLinks,
  isValidNavigationCoords,
} from "@/lib/map/navigation-urls";

type ClaimNavigationActionsProps = {
  latitude: number;
  longitude: number;
  fullWidth?: boolean;
};

function openExternalUrl(url: string) {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) {
    return;
  }

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function ClaimNavigationActions({
  latitude,
  longitude,
  fullWidth = false,
}: ClaimNavigationActionsProps) {
  const dialogId = useId();
  const titleId = useId();
  const navigateButtonRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false);
  const [open, setOpen] = useState(false);

  const links = isValidNavigationCoords(latitude, longitude)
    ? buildExternalNavigationLinks(latitude, longitude)
    : null;

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (sheetRef.current?.contains(target)) {
        return;
      }
      if (navigateButtonRef.current?.contains(target)) {
        return;
      }
      // Keep focus available for return-to-Navigate after close.
      if (event.cancelable) {
        event.preventDefault();
      }
      setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (wasOpenRef.current && !open) {
      navigateButtonRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  if (!links) {
    return null;
  }

  function choose(url: string) {
    openExternalUrl(url);
    setOpen(false);
  }

  return (
    <div className="relative">
      <Button
        ref={navigateButtonRef}
        type="button"
        variant="primary"
        className={fullWidth ? "w-full" : "w-full sm:w-fit"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => setOpen((prev) => !prev)}
      >
        Navigate
      </Button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-foreground/20 motion-fade-in md:bg-transparent"
            aria-hidden="true"
          />
          <div
            id={dialogId}
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={[
              "z-50 border border-border bg-surface shadow-lg motion-fade-slide-up",
              "fixed inset-x-0 bottom-0 rounded-t-[var(--radius-card)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
              "md:absolute md:inset-x-auto md:bottom-auto md:left-0 md:top-[calc(100%+0.5rem)] md:w-72 md:rounded-[var(--radius-card)] md:pb-4",
            ].join(" ")}
          >
            <p id={titleId} className="text-sm font-semibold text-foreground">
              Open destination in
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              <li>
                <button
                  type="button"
                  className="motion-interactive-press flex w-full items-center rounded-[var(--radius-card)] border border-border bg-accent-soft px-3 py-2.5 text-left text-sm font-medium text-foreground hover:border-accent"
                  onClick={() => choose(links.waze)}
                >
                  Open in Waze
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="motion-interactive-press flex w-full items-center rounded-[var(--radius-card)] border border-border bg-surface px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-accent-soft"
                  onClick={() => choose(links.googleMaps)}
                >
                  Open in Google Maps
                </button>
              </li>
              {links.appleMaps ? (
                <li>
                  <button
                    type="button"
                    className="motion-interactive-press flex w-full items-center rounded-[var(--radius-card)] border border-border bg-surface px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-accent-soft"
                    onClick={() => choose(links.appleMaps!)}
                  >
                    Open in Apple Maps
                  </button>
                </li>
              ) : null}
            </ul>
            <button
              type="button"
              className="mt-3 w-full text-center text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
