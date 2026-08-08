import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandedLoadingState } from "@/components/brand/BrandedLoadingState";
import {
  MapRouteLoadingChrome,
  MapRouteTransitionShell,
} from "@/components/map/MapRouteTransitionShell";
import { MapLoadingState } from "@/components/map/MapLoadingState";

describe("MapRouteTransitionShell", () => {
  it("reuses the shared driving-car branded loader", () => {
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
    render(<MapRouteTransitionShell mode="publisher" reducedMotion />);
    expect(screen.getByTestId("map-route-transition")).toHaveAttribute(
      "data-mode",
      "publisher",
    );
    expect(screen.getByTestId("branded-loading-car")).toBeInTheDocument();
  });

  it("exposes a polite live region without blank content", () => {
    render(<MapRouteTransitionShell mode="seeker" reducedMotion />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-busy", "true");
  });
});

describe("MapRouteLoadingChrome", () => {
  it("renders seeker loading shell at map dimensions with branded car", () => {
    render(<MapRouteLoadingChrome mode="seeker" layout="map" />);
    const shell = screen.getByTestId("map-loading-shell");
    expect(shell.className).toContain("app-shell--map");
    expect(screen.getByTestId("branded-loading-car")).toBeInTheDocument();
    expect(shell.querySelector(".animate-pulse")).toBeNull();
  });

  it("renders publisher loading shell with compose map slot", () => {
    render(<MapRouteLoadingChrome mode="publisher" layout="page" />);
    expect(screen.getByTestId("spots-new-loading-shell")).toBeInTheDocument();
    expect(screen.getByTestId("branded-loading-car")).toBeInTheDocument();
    expect(document.querySelector(".leaver-map-picker-shell")).not.toBeNull();
  });
});

describe("shared branded loader reuse", () => {
  it("MapLoadingState and page loader share the same car test id", () => {
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
