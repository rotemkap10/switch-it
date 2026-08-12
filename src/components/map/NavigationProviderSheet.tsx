"use client";

import { useEffect, useId, useRef } from "react";

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
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    logPostClaimNavigationDev("NavigationProviderSheet mounted");
    logPostClaimNavigationDev("sheet visible");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
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
      if (returnFocusRef?.current?.contains(target)) {
        return;
      }
      onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open, onClose, returnFocusRef]);

  useEffect(() => {
    if (wasOpenRef.current && !open) {
      returnFocusRef?.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open, returnFocusRef]);

  if (!open) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-foreground/20 motion-fade-in"
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="navigation-provider-sheet"
        className={[
          "fixed inset-x-0 bottom-0 z-[61] rounded-t-[var(--radius-card)] border border-border",
          "bg-surface p-4 shadow-[var(--shadow-card)] motion-fade-slide-up app-overlay-pad-bottom",
          "md:inset-x-auto md:left-1/2 md:w-[min(100%-2rem,24rem)] md:-translate-x-1/2 md:rounded-[var(--radius-card)]",
        ].join(" ")}
      >
        <p id={titleId} className="text-sm font-semibold text-foreground">
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
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
    </>
  );
}
