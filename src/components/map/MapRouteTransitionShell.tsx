"use client";

import { useEffect } from "react";

import { BrandedLoadingState } from "@/components/brand/BrandedLoadingState";
import { AppShellHeaderLoadingPlaceholder } from "@/components/layout/AppShellHeaderInner";
import { useAppLaunchReady } from "@/components/shell/AppLaunchReadyContext";
import {
  MAP_SHEET_CLASS,
  MAP_SHEET_HOST_CLASS,
} from "@/lib/map/bottom-stack";
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

function PublisherMapFirstLoadingBody({
  mode,
}: {
  mode: MapRouteTransitionMode;
}) {
  return (
    <div
      className="publisher-compose publisher-compose--map-first"
      data-testid="spots-new-map-first-loading"
      data-layout="map-first"
    >
      <div
        className="absolute inset-0"
        data-testid="spots-new-map-loading-viewport"
      >
        <MapRouteTransitionShell mode={mode} variant="fullscreen" />
      </div>
      {/* Reserve final overlay geometry — invisible, no late layout shift. */}
      <div className="publisher-compose-top-host" aria-hidden="true">
        <div className="publisher-compose-search min-h-10" />
      </div>
      <div className={MAP_SHEET_HOST_CLASS} aria-hidden="true">
        <div
          className={[MAP_SHEET_CLASS, "publisher-compose-surface"].join(" ")}
          data-testid="spots-new-loading-sheet-reserve"
        >
          <div className="min-h-24" />
        </div>
      </div>
    </div>
  );
}

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
        <AppShellHeaderLoadingPlaceholder
          mode={mode === "publisher" ? "publisher" : "seeker"}
        />
      </div>
      <main
        className={[
          "app-shell-main",
          isMap ? "app-shell-main--map" : "app-shell-main--page",
        ].join(" ")}
      >
        {isMap ? (
          mode === "publisher" ? (
            <PublisherMapFirstLoadingBody mode={mode} />
          ) : (
            <MapRouteTransitionShell mode={mode} variant="fullscreen" />
          )
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
