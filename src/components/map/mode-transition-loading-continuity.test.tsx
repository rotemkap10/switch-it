import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MapRouteLoadingChrome } from "@/components/map/MapRouteTransitionShell";
import { MapLoadingState } from "@/components/map/MapLoadingState";

const launchReadyRef = vi.hoisted(() => ({ current: true }));

vi.mock("@/components/shell/AppLaunchReadyContext", () => ({
  useAppLaunchReady: () => launchReadyRef.current,
}));

describe("mode transition loading continuity", () => {
  beforeEach(() => {
    launchReadyRef.current = true;
  });

  it("keeps only one branded car active inside the Share map-first shell", () => {
    render(<MapRouteLoadingChrome mode="publisher" layout="map" />);
    expect(screen.getAllByTestId("branded-loading-car")).toHaveLength(1);
    expect(screen.getByTestId("spots-new-map-first-loading")).toHaveAttribute(
      "data-layout",
      "map-first",
    );
    expect(
      document.querySelector(
        ".leaver-map-picker-shell:not(.leaver-map-picker-shell--fill)",
      ),
    ).toBeNull();
  });

  it("enters Share a Spot final map shell before map-ready", () => {
    render(<MapRouteLoadingChrome mode="publisher" layout="map" />);
    const shell = screen.getByTestId("spots-new-loading-shell");
    expect(shell).toHaveAttribute("data-layout", "map");
    expect(shell.className).toContain("app-shell--map");
    expect(
      screen.getByTestId("spots-new-map-loading-viewport"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("branded-loading-car")).toBeInTheDocument();
  });

  it("enters Find Parking final map shell before map-ready", () => {
    render(<MapRouteLoadingChrome mode="seeker" layout="map" />);
    const shell = screen.getByTestId("map-loading-shell");
    expect(shell).toHaveAttribute("data-layout", "map");
    expect(shell.className).toContain("app-shell--map");
    expect(screen.getByTestId("branded-loading-car")).toBeInTheDocument();
  });

  it("uses the same fill viewport for Share chunk loading and map-first compose", () => {
    const loader = readFileSync(
      resolve(
        process.cwd(),
        "src/components/spots/SpotLocationPickerLoader.tsx",
      ),
      "utf8",
    );
    const form = readFileSync(
      resolve(process.cwd(), "src/components/spots/PublishSpotForm.tsx"),
      "utf8",
    );
    const routeLoading = readFileSync(
      resolve(process.cwd(), "src/app/spots/new/loading.tsx"),
      "utf8",
    );
    const baseMap = readFileSync(
      resolve(process.cwd(), "src/components/map/BaseMap.tsx"),
      "utf8",
    );
    const css = readFileSync(
      resolve(process.cwd(), "src/app/globals.css"),
      "utf8",
    );

    expect(form).toContain('layout="fill"');
    expect(form).toContain("publisher-compose--map-first");
    expect(loader).toContain("LEAVER_MAP_SHELL_FILL_CLASS");
    expect(loader).toContain('data-layout="fill"');
    expect(loader).not.toMatch(/LEAVER_MAP_SHELL_HEIGHT_CLASS/);
    expect(routeLoading).toContain('layout="map"');
    expect(routeLoading).not.toContain('layout="page"');

    // Loading and loaded map share one BaseMap viewport; loader fades, no blank.
    expect(baseMap).toContain("map-loader-fade");
    expect(baseMap).toContain("is-hidden");
    expect(baseMap).toContain("MapLoadingState");
    expect(css).toContain(".map-loader-fade.is-hidden");
    expect(css).toMatch(/\.map-loader-fade\.is-hidden\s*\{[^}]*opacity:\s*0/);
  });

  it("does not use the legacy inset card loader for map-first Share compose", () => {
    render(<MapRouteLoadingChrome mode="publisher" layout="map" />);
    expect(
      document.querySelector(".publisher-compose.mx-auto"),
    ).toBeNull();
    expect(
      document.querySelector(
        ".leaver-map-picker-shell:not(.leaver-map-picker-shell--fill)",
      ),
    ).toBeNull();
    expect(screen.getByTestId("spots-new-map-first-loading")).toBeInTheDocument();
  });

  it("keeps MapLoadingState compact inside a stable parent viewport", () => {
    render(
      <div
        className="leaver-map-picker-shell leaver-map-picker-shell--fill"
        data-testid="shared-viewport"
        style={{ height: 400 }}
      >
        <MapLoadingState reducedMotion />
      </div>,
    );

    expect(screen.getByTestId("shared-viewport")).toContainElement(
      screen.getByTestId("branded-loading-car"),
    );
    expect(screen.getByTestId("branded-loading-state")).toHaveAttribute(
      "data-variant",
      "compact",
    );
    expect(screen.getByText("Loading the map…")).toBeInTheDocument();
  });
});
