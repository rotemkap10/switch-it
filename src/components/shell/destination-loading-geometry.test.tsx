import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthRouteLoadingChrome } from "@/components/shell/AuthRouteLoadingChrome";
import { PageRouteLoadingChrome } from "@/components/shell/PageRouteLoadingChrome";
import { MapRouteLoadingChrome } from "@/components/map/MapRouteTransitionShell";
import { resolveRouteLoadingKind } from "@/lib/motion/route-transition";

const launchReadyRef = vi.hoisted(() => ({ current: true }));

vi.mock("@/components/shell/AppLaunchReadyContext", () => ({
  useAppLaunchReady: () => launchReadyRef.current,
}));

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("app-wide destination loading geometry", () => {
  it("keeps map destinations on map shells", () => {
    launchReadyRef.current = true;
    const { unmount: unmountSeeker } = render(
      <MapRouteLoadingChrome mode="seeker" layout="map" />,
    );
    expect(screen.getByTestId("map-loading-shell")).toHaveAttribute(
      "data-layout",
      "map",
    );
    unmountSeeker();

    render(<MapRouteLoadingChrome mode="publisher" layout="map" />);
    expect(screen.getByTestId("spots-new-loading-shell")).toHaveAttribute(
      "data-layout",
      "map",
    );
    expect(screen.getByTestId("spots-new-map-first-loading")).toBeInTheDocument();
  });

  it("keeps profile/history on authenticated page shells", () => {
    render(<PageRouteLoadingChrome testId="profile-loading-shell" />);
    expect(screen.getByTestId("profile-loading-shell")).toHaveAttribute(
      "data-layout",
      "page",
    );
    expect(screen.getByTestId("branded-loading-car")).toBeInTheDocument();
    expect(screen.getByTestId("profile-loading-shell").className).toContain(
      "app-shell",
    );
  });

  it("keeps auth and onboarding on auth-page shells, not app-shell", () => {
    render(<AuthRouteLoadingChrome testId="auth-loading-shell" />);
    const shell = screen.getByTestId("auth-loading-shell");
    expect(shell).toHaveAttribute("data-layout", "auth");
    expect(shell.className).toContain("auth-page");
    expect(shell.className).not.toContain("app-shell");
    expect(screen.getByTestId("auth-brand")).toBeInTheDocument();
    expect(screen.getByTestId("branded-loading-car")).toBeInTheDocument();
  });

  it("wires loading.tsx files to destination-matched chrome", () => {
    expect(source("src/app/map/loading.tsx")).toContain('layout="map"');
    expect(source("src/app/spots/new/loading.tsx")).toContain('layout="map"');
    expect(source("src/app/profile/loading.tsx")).toContain(
      "PageRouteLoadingChrome",
    );
    expect(source("src/app/history/loading.tsx")).toContain(
      "PageRouteLoadingChrome",
    );
    expect(source("src/app/(auth)/loading.tsx")).toContain(
      "AuthRouteLoadingChrome",
    );
    expect(source("src/app/onboarding/loading.tsx")).toContain(
      "AuthRouteLoadingChrome",
    );
    expect(source("src/app/onboarding/loading.tsx")).not.toContain(
      "PageRouteLoadingChrome",
    );
  });

  it("keeps claimed handoff live-map chunk loading on the expanded live shell", () => {
    const liveLoader = source(
      "src/components/spots/PublisherLiveProgressMapLoader.tsx",
    );
    expect(liveLoader).toContain("publisher-live-map-shell--expanded");
    expect(liveLoader).not.toContain("publisherPreviewShellClass");
    expect(liveLoader).not.toContain('publisherPreviewShellClass("claimed")');
  });

  it("classifies important routes for destination-owned loading", () => {
    expect(resolveRouteLoadingKind("/map")).toBe("map-seeker");
    expect(resolveRouteLoadingKind("/spots/new")).toBe("map-publisher");
    expect(resolveRouteLoadingKind("/profile")).toBe("page");
    expect(resolveRouteLoadingKind("/history")).toBe("page");
    expect(resolveRouteLoadingKind("/login")).toBe("auth");
    expect(resolveRouteLoadingKind("/register")).toBe("auth");
    expect(resolveRouteLoadingKind("/onboarding/vehicle")).toBe("auth");
  });
});
