"use client";

import { useEffect } from "react";

import { BrandedLoadingState } from "@/components/brand/BrandedLoadingState";
import { useAppLaunchReady } from "@/components/shell/AppLaunchReadyContext";
import { markRouteShell } from "@/lib/map/map-perf";

export type MapRouteTransitionMode = "seeker" | "publisher";

type MapRouteTransitionShellProps = {
  mode: MapRouteTransitionMode;
  /** Fill parent (map stage) vs page compose map slot. */
  variant?: "fullscreen" | "compose";
  className?: string;
  /** Test override for prefers-reduced-motion. */
  reducedMotion?: boolean;
};

/**
 * Route-level loading visual for map destinations — shared driving-car animation.
 * (Keeps the historical test id / mode attrs for shell chrome.)
 * Cold-launch splash suppresses the car so logo → map feels continuous.
 */
export function MapRouteTransitionShell({
  mode,
  variant = "fullscreen",
  className = "",
  reducedMotion,
}: MapRouteTransitionShellProps) {
  const launchReady = useAppLaunchReady();

  useEffect(() => {
    markRouteShell();
  }, []);

  if (!launchReady) {
    return (
      <div
        className={[
          "map-route-transition",
          variant === "compose"
            ? "map-route-transition--compose"
            : "map-route-transition--fullscreen",
          className,
        ].join(" ")}
        data-testid="map-route-transition"
        data-mode={mode}
        data-launch-suppressed="true"
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={[
        "map-route-transition",
        variant === "compose"
          ? "map-route-transition--compose"
          : "map-route-transition--fullscreen",
        className,
      ].join(" ")}
      data-testid="map-route-transition"
      data-mode={mode}
    >
      <BrandedLoadingState
        label="Loading…"
        variant={variant === "compose" ? "compact" : "page"}
        ariaLabel="Loading page"
        reducedMotion={reducedMotion}
        className="map-route-transition__branded"
      />
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
 * During cold launch, render an empty shell so the branded splash stays sole UI.
 */
export function MapRouteLoadingChrome({
  mode,
  layout,
}: MapRouteLoadingChromeProps) {
  const launchReady = useAppLaunchReady();
  const isMap = layout === "map";
  const testId =
    mode === "seeker" ? "map-loading-shell" : "spots-new-loading-shell";

  if (!launchReady) {
    return (
      <div
        className={["app-shell", isMap ? "app-shell--map" : ""].join(" ")}
        data-testid={testId}
        data-layout={isMap ? "map" : "page"}
        data-launch-suppressed="true"
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={["app-shell", isMap ? "app-shell--map" : ""].join(" ")}
      data-testid={testId}
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
