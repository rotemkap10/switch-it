import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BrandedLoadingState } from "@/components/brand/BrandedLoadingState";
import {
  MapRouteLoadingChrome,
  MapRouteTransitionShell,
} from "@/components/map/MapRouteTransitionShell";
import { MapLoadingState } from "@/components/map/MapLoadingState";

const launchReadyRef = vi.hoisted(() => ({ current: true }));

vi.mock("@/components/shell/AppLaunchReadyContext", () => ({
  useAppLaunchReady: () => launchReadyRef.current,
}));

describe("MapRouteTransitionShell", () => {
  it("reuses the shared driving-car branded loader", () => {
    launchReadyRef.current = true;
    render(<MapRouteTransitionShell mode="seeker" reducedMotion />);
    expect(screen.getByTestId("map-route-transition")).toHaveAttribute(
      "data-mode",
      "seeker",
    );
    expect(screen.getByTestId("branded-loading-state")).toBeInTheDocument();
    expect(screen.getByTestId("branded-loading-car")).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("uses the same car for publisher mode", () => {
    launchReadyRef.current = true;
    render(<MapRouteTransitionShell mode="publisher" reducedMotion />);
    expect(screen.getByTestId("map-route-transition")).toHaveAttribute(
      "data-mode",
      "publisher",
    );
    expect(screen.getByTestId("branded-loading-car")).toBeInTheDocument();
  });

  it("exposes a polite live region without blank content", () => {
    launchReadyRef.current = true;
    render(<MapRouteTransitionShell mode="seeker" reducedMotion />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-busy", "true");
  });

  it("suppresses the car while cold-launch splash is active", () => {
    launchReadyRef.current = false;
    render(<MapRouteTransitionShell mode="seeker" reducedMotion />);
    expect(screen.getByTestId("map-route-transition")).toHaveAttribute(
      "data-launch-suppressed",
      "true",
    );
    expect(screen.queryByTestId("branded-loading-car")).not.toBeInTheDocument();
  });
});

describe("MapRouteLoadingChrome", () => {
  it("renders seeker loading shell at map dimensions with branded car", () => {
    launchReadyRef.current = true;
    render(<MapRouteLoadingChrome mode="seeker" layout="map" />);
    const shell = screen.getByTestId("map-loading-shell");
    expect(shell.className).toContain("app-shell--map");
    expect(screen.getByTestId("branded-loading-car")).toBeInTheDocument();
    expect(shell.querySelector(".animate-pulse")).toBeNull();
    const inner = screen.getByTestId("app-shell-header-inner");
    expect(inner.className).toBe("app-shell-header-inner");
    expect(inner.querySelector("img")).toHaveAttribute(
      "src",
      "/branding/switch-it-logo.png",
    );
  });

  it("renders publisher loading shell with compose map slot", () => {
    launchReadyRef.current = true;
    render(<MapRouteLoadingChrome mode="publisher" layout="page" />);
    expect(screen.getByTestId("spots-new-loading-shell")).toBeInTheDocument();
    expect(screen.getByTestId("branded-loading-car")).toBeInTheDocument();
    expect(document.querySelector(".leaver-map-picker-shell")).not.toBeNull();
  });

  it("renders publisher map-first loading shell before map-ready", () => {
    launchReadyRef.current = true;
    render(<MapRouteLoadingChrome mode="publisher" layout="map" />);
    const shell = screen.getByTestId("spots-new-loading-shell");
    expect(shell).toHaveAttribute("data-layout", "map");
    expect(shell.className).toContain("app-shell--map");
    expect(screen.getByTestId("spots-new-map-first-loading")).toHaveAttribute(
      "data-layout",
      "map-first",
    );
    expect(screen.getByTestId("spots-new-map-loading-viewport")).toBeInTheDocument();
    expect(screen.getByTestId("spots-new-loading-sheet-reserve")).toBeInTheDocument();
    expect(screen.getByTestId("branded-loading-car")).toBeInTheDocument();
    expect(document.querySelector(".leaver-map-picker-shell:not(.leaver-map-picker-shell--fill)")).toBeNull();
  });

  it("renders an empty shell while cold-launch splash owns loading", () => {
    launchReadyRef.current = false;
    render(<MapRouteLoadingChrome mode="seeker" layout="map" />);
    expect(screen.getByTestId("map-loading-shell")).toHaveAttribute(
      "data-launch-suppressed",
      "true",
    );
    expect(screen.queryByTestId("branded-loading-car")).not.toBeInTheDocument();
  });
});

describe("shared branded loader reuse", () => {
  it("MapLoadingState and page loader share the same car test id", () => {
    launchReadyRef.current = true;
    const { unmount } = render(<MapLoadingState reducedMotion />);
    expect(screen.getByTestId("branded-loading-car")).toBeInTheDocument();
    expect(screen.getByText("Loading the map…")).toBeInTheDocument();
    unmount();

    render(
      <BrandedLoadingState label="Loading…" variant="page" reducedMotion />,
    );
    expect(screen.getByTestId("branded-loading-car")).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});
