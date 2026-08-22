"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

import { PORCELAIN, SIGNAL_BLUE } from "@/lib/branding/colors";

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

function Wheel({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <g className="branded-loading-wheel">
        <circle r="6.4" fill={SIGNAL_BLUE} />
        <circle r="2.6" fill={PORCELAIN} />
        <path
          d="M0-4.2v8.4M-4.2 0h8.4"
          stroke={PORCELAIN}
          strokeWidth="1.15"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
}

/** Shared driving-car visual used by map and route loaders. Not the app logo. */
export function BrandedLoadingCar({ animate }: { animate: boolean }) {
  const reactId = useId().replace(/:/g, "");
  const clipId = `branded-loading-road-${reactId}`;

  return (
    <div
      className={[
        "branded-loading-car",
        animate ? "branded-loading-car-animate" : "",
      ].join(" ")}
      aria-hidden="true"
      data-testid="branded-loading-car"
      data-animated={animate ? "true" : "false"}
    >
      <svg
        viewBox="0 0 136 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="branded-loading-car__svg"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="10" y="44" width="116" height="8" rx="4" />
          </clipPath>
        </defs>

        <rect x="10" y="44" width="116" height="8" rx="4" fill={SIGNAL_BLUE} />
        <g clipPath={`url(#${clipId})`}>
          <g className="branded-loading-dashes">
            {[-30, -10, 10, 30, 50, 70, 90, 110, 130, 150].map((x) => (
              <rect
                key={x}
                x={x}
                y="47"
                width="10"
                height="2.2"
                rx="1.1"
                fill={PORCELAIN}
              />
            ))}
          </g>
        </g>

        <g className="branded-loading-car-body">
          <path
            d="M40 33.5c2-6.2 9.5-10 18-10h16c9.5 0 16 3.4 21 8.2l7.5 2.3c1.6.4 2.7 1.8 2.7 3.4v3.1H38.2v-3.6c0-1.4 1-2.6 2.4-3.1l-.6-.3Z"
            fill={SIGNAL_BLUE}
          />
          <path
            d="M55 23.8h17.5c6.4 0 11.2 2.8 14.6 6.6H53.6c.2-2.6 1-5 1.4-6.6Z"
            fill={PORCELAIN}
          />
          <path
            d="M71.5 23.8v6.6"
            stroke={SIGNAL_BLUE}
            strokeWidth="1.2"
          />
          <rect x="37.5" y="35.5" width="5" height="4" rx="1" fill={PORCELAIN} />
          <rect x="98" y="35.2" width="7.5" height="3.6" rx="1.2" fill={PORCELAIN} />
          <Wheel cx={54} cy={40.2} />
          <Wheel cx={92} cy={40.2} />
        </g>
      </svg>
    </div>
  );
}

/**
 * Provider-neutral Switch It loading visual (driving car + status).
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
        "bg-surface px-4 text-center",
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
      <BrandedLoadingCar animate={!prefersReducedMotion} />
      <p className="text-sm font-medium text-foreground">{label}</p>
      {supportingText ? (
        <p className="max-w-xs text-xs text-muted">{supportingText}</p>
      ) : null}
      {children}
    </div>
  );
}
