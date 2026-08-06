import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  MapRouteLoadingChrome,
  MapRouteTransitionShell,
} from "@/components/map/MapRouteTransitionShell";

describe("MapRouteTransitionShell", () => {
  it("uses Find copy for seeker mode", () => {
    render(<MapRouteTransitionShell mode="seeker" reducedMotion />);
    expect(screen.getByTestId("map-route-transition")).toHaveAttribute(
      "data-mode",
      "seeker",
    );
    expect(screen.getByText("Finding nearby parking…")).toBeInTheDocument();
  });

  it("uses Share copy for publisher mode", () => {
    render(<MapRouteTransitionShell mode="publisher" reducedMotion />);
    expect(screen.getByText("Preparing your parking spot…")).toBeInTheDocument();
  });

  it("exposes a polite live region without blank content", () => {
    render(<MapRouteTransitionShell mode="seeker" reducedMotion />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-busy", "true");
  });
});

describe("MapRouteLoadingChrome", () => {
  it("renders seeker loading shell at map dimensions", () => {
    render(<MapRouteLoadingChrome mode="seeker" layout="map" />);
    const shell = screen.getByTestId("map-loading-shell");
    expect(shell.className).toContain("app-shell--map");
    expect(screen.getByText("Finding nearby parking…")).toBeInTheDocument();
    expect(shell.querySelector(".animate-pulse")).toBeNull();
  });

  it("renders publisher loading shell with compose map slot", () => {
    render(<MapRouteLoadingChrome mode="publisher" layout="page" />);
    expect(screen.getByTestId("spots-new-loading-shell")).toBeInTheDocument();
    expect(
      screen.getByText("Preparing your parking spot…"),
    ).toBeInTheDocument();
    expect(document.querySelector(".leaver-map-picker-shell")).not.toBeNull();
  });
});
