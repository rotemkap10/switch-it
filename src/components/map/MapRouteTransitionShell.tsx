"use client";

import { useEffect } from "react";

import { SwitchItLogoMark } from "@/components/brand/SwitchItLogoMark";
import { markRouteShell } from "@/lib/map/map-perf";

export type MapRouteTransitionMode = "seeker" | "publisher";

const STATUS_COPY: Record<MapRouteTransitionMode, string> = {
  seeker: "Finding nearby parking…",
  publisher: "Preparing your parking spot…",
};

type MapRouteTransitionShellProps = {
  mode: MapRouteTransitionMode;
  /** Fill parent (map stage) vs page compose map slot. */
  variant?: "fullscreen" | "compose";
  className?: string;
  /** Test override for prefers-reduced-motion. */
  reducedMotion?: boolean;
};

function usePrefersReducedMotion(override?: boolean): boolean {
  if (typeof override === "boolean") {
    return override;
  }
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Branded map-route transition visual — local SVG/CSS only.
 * No artificial minimum duration; disappears as soon as the route replaces it.
 */
export function MapRouteTransitionShell({
  mode,
  variant = "fullscreen",
  className = "",
  reducedMotion,
}: MapRouteTransitionShellProps) {
  const prefersReduced = usePrefersReducedMotion(reducedMotion);
  const status = STATUS_COPY[mode];

  useEffect(() => {
    markRouteShell();
  }, []);

  return (
    <div
      className={[
        "map-route-transition",
        variant === "compose"
          ? "map-route-transition--compose"
          : "map-route-transition--fullscreen",
        prefersReduced ? "is-reduced-motion" : "",
        className,
      ].join(" ")}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="map-route-transition"
      data-mode={mode}
    >
      <div className="map-route-transition__grid" aria-hidden="true" />
      <div className="map-route-transition__stage" aria-hidden="true">
        <svg
          className="map-route-transition__road"
          viewBox="0 0 200 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 58 C 48 58, 70 22, 100 22 C 130 22, 152 58, 188 58"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="6 8"
            className="map-route-transition__path"
          />
        </svg>
        <div className="map-route-transition__pin">
          <SwitchItLogoMark size={56} withTile={false} />
        </div>
        <div className="map-route-transition__vehicle">
          <svg
            width="28"
            height="16"
            viewBox="0 0 28 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="1"
              y="5"
              width="22"
              height="8"
              rx="2.5"
              fill="#55bff3"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <path d="M8 5 L11 2 H18 L21 5" fill="#2fa9e6" />
            <circle cx="7" cy="13.5" r="2" fill="#12324a" />
            <circle cx="19" cy="13.5" r="2" fill="#12324a" />
          </svg>
        </div>
      </div>
      <p className="map-route-transition__status">{status}</p>
    </div>
  );
}

type MapRouteLoadingChromeProps = {
  mode: MapRouteTransitionMode;
  layout: "map" | "page";
};

/**
 * Full-page loading fallback used by route loading.tsx files.
 * Matches final shell dimensions; header chrome is static (not interactive).
 */
export function MapRouteLoadingChrome({
  mode,
  layout,
}: MapRouteLoadingChromeProps) {
  const isMap = layout === "map";

  return (
    <div
      className={["app-shell", isMap ? "app-shell--map" : ""].join(" ")}
      data-testid={
        mode === "seeker" ? "map-loading-shell" : "spots-new-loading-shell"
      }
      data-layout={isMap ? "map" : "page"}
    >
      <div className="app-shell-header border-b border-border">
        <div
          className={[
            "app-shell-header-inner",
            isMap
              ? "app-shell-header-inner--wide"
              : "app-shell-header-inner--contained",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              Switch It
            </p>
            <div
              className="h-8 w-8 rounded-full bg-accent-soft"
              aria-hidden="true"
            />
          </div>
          <div
            className="relative flex h-[var(--app-tap-min)] w-full items-center rounded-[var(--radius-card)] border border-border bg-accent-soft p-0.5 md:hidden"
            aria-hidden="true"
          >
            <span
              className={[
                "absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-[calc(var(--radius-card)-2px)] bg-accent shadow-sm",
                mode === "publisher" ? "translate-x-full" : "",
              ].join(" ")}
            />
            <span className="relative z-[1] flex flex-1 items-center justify-center text-xs font-semibold text-foreground">
              Find parking
            </span>
            <span className="relative z-[1] flex flex-1 items-center justify-center text-xs font-semibold text-muted">
              Share a spot
            </span>
          </div>
        </div>
      </div>
      <main
        className={[
          "app-shell-main",
          isMap ? "app-shell-main--map" : "app-shell-main--page",
        ].join(" ")}
      >
        {isMap ? (
          <MapRouteTransitionShell mode={mode} variant="fullscreen" />
        ) : (
          <div className="publisher-compose mx-auto w-full max-w-lg md:max-w-xl">
            <div className="mb-3 flex flex-col gap-1">
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                Share a spot
              </p>
              <p className="text-sm text-muted">
                Let nearby drivers know when you’re leaving.
              </p>
            </div>
            <div className="publisher-compose-surface">
              <div className="leaver-map-picker-shell overflow-hidden rounded-[var(--radius-card)]">
                <MapRouteTransitionShell mode={mode} variant="compose" />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
