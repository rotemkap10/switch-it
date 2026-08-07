"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Delay before showing the slow-connection hint on map loads. */
export const MAP_SLOW_NETWORK_HINT_MS = 3000;

/** Loader ↔ map fade duration (BaseMap overlay). */
export const MAP_READY_FADE_MS = 250;

export type BrandedLoadingVariant = "compact" | "page";

type BrandedLoadingStateProps = {
  /** Primary status line (e.g. “Loading…” / “Loading the map…”). */
  label: string;
  /** Optional secondary line under the label. */
  supportingText?: string | null;
  /**
   * compact — fills an embedded map/container area
   * page — full-page / content-area route transition
   */
  variant?: BrandedLoadingVariant;
  className?: string;
  /** Accessible name; defaults to label. */
  ariaLabel?: string;
  /** Test override; otherwise uses prefers-reduced-motion. */
  reducedMotion?: boolean;
  children?: ReactNode;
};

function useMediaPrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

/** Shared parking-pin visual used by map and route loaders. */
export function BrandedLoadingPin({ animate }: { animate: boolean }) {
  return (
    <div
      className={[
        "map-loading-pin",
        animate ? "map-loading-pin-animate" : "",
      ].join(" ")}
      aria-hidden="true"
      data-testid="branded-loading-pin"
    >
      <span className="map-loading-ring map-loading-ring-a" />
      <span className="map-loading-ring map-loading-ring-b" />
      <svg
        width="40"
        height="48"
        viewBox="0 0 40 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-[1]"
      >
        <path
          d="M20 46c0 0 14-14.2 14-26a14 14 0 1 0-28 0c0 11.8 14 26 14 26Z"
          fill="#55bff3"
          stroke="#ffffff"
          strokeWidth="2.5"
        />
        <circle cx="20" cy="18" r="7.5" fill="#ffffff" />
        <path
          d="M17.2 13.5h3.6c1.85 0 3 1 3 2.55 0 1.7-1.2 2.7-3.2 2.7H19.4v4.75h-2.2V13.5Z"
          fill="#55bff3"
        />
      </svg>
    </div>
  );
}

/**
 * Provider-neutral Switch It loading visual (parking pin + status).
 * Map and route loaders share this — do not introduce a second spinner.
 */
export function BrandedLoadingState({
  label,
  supportingText = null,
  variant = "compact",
  className = "",
  ariaLabel,
  reducedMotion,
  children,
}: BrandedLoadingStateProps) {
  const mediaReduced = useMediaPrefersReducedMotion();
  const prefersReducedMotion =
    typeof reducedMotion === "boolean" ? reducedMotion : mediaReduced;

  return (
    <div
      className={[
        "flex h-full w-full flex-col items-center justify-center gap-3",
        "bg-gradient-to-b from-accent-soft to-surface px-4 text-center",
        variant === "page" ? "branded-loading-page min-h-[12rem]" : "",
        className,
      ].join(" ")}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={ariaLabel ?? label}
      data-testid="branded-loading-state"
      data-variant={variant}
    >
      <BrandedLoadingPin animate={!prefersReducedMotion} />
      <p className="text-sm font-medium text-foreground">{label}</p>
      {supportingText ? (
        <p className="max-w-xs text-xs text-muted">{supportingText}</p>
      ) : null}
      {children}
    </div>
  );
}
