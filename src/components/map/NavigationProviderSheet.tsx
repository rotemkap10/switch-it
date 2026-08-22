"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { WEB_HANDOFF_LOCATION_DISCLOSURE } from "@/lib/location/handoff-disclosures";
import { logPostClaimNavigationDev } from "@/lib/map/post-claim-navigation";
import type {
  ExternalNavigationLinks,
  NavigationProviderId,
} from "@/lib/map/navigation-urls";

type NavigationProviderSheetProps = {
  open: boolean;
  onClose: () => void;
  links: ExternalNavigationLinks;
  onChoose: (url: string, providerId: NavigationProviderId) => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  title?: string;
  description?: string | null;
  dismissLabel?: string;
};

const PROVIDERS: Array<{
  id: "waze" | "appleMaps" | "googleMaps";
  label: string;
  emphasized?: boolean;
}> = [
  { id: "waze", label: "Waze", emphasized: true },
  { id: "googleMaps", label: "Google Maps" },
  { id: "appleMaps", label: "Apple Maps" },
];

/**
 * Full-viewport centered navigation chooser.
 * Portaled to document.body with the same shell as CancellationReasonSheet so
 * map/handoff layout transforms cannot scope fixed positioning.
 */
export function NavigationProviderSheet({
  open,
  onClose,
  links,
  onChoose,
  returnFocusRef,
  title = "Open in",
  description = WEB_HANDOFF_LOCATION_DISCLOSURE,
  dismissLabel = "Dismiss",
}: NavigationProviderSheetProps) {
  const titleId = useId();
  const descId = useId();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    logPostClaimNavigationDev("NavigationProviderSheet mounted");
    logPostClaimNavigationDev("sheet visible");

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (wasOpenRef.current && !open) {
      returnFocusRef?.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open, returnFocusRef]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="cancellation-sheet-backdrop motion-fade-in"
      role="presentation"
      data-testid="navigation-provider-sheet-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        data-testid="navigation-provider-sheet"
        className="install-sheet motion-soft-scale-in"
      >
        <p id={titleId} className="install-sheet__title">
          {title}
        </p>
        {description ? (
          <p id={descId} className="mt-1 text-xs leading-5 text-muted">
            {description}
          </p>
        ) : null}
        <ul className="mt-3 flex flex-col gap-2">
          {PROVIDERS.map((provider) => (
            <li key={provider.id}>
              <button
                type="button"
                className={[
                  "motion-interactive-press flex min-h-[var(--app-tap-min)] w-full items-center rounded-[var(--radius-card)] border px-3 py-2.5 text-left text-sm font-medium text-foreground",
                  provider.emphasized
                    ? "border-border bg-accent-soft hover:border-accent"
                    : "border-border bg-surface hover:bg-accent-soft",
                ].join(" ")}
                onClick={() => onChoose(links[provider.id], provider.id)}
              >
                {provider.label}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-3 min-h-[2.5rem] w-full text-center text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
          onClick={onClose}
        >
          {dismissLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}
