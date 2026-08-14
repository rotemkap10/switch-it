import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandedLoadingState } from "@/components/brand/BrandedLoadingState";
import { PageRouteLoadingChrome } from "@/components/shell/PageRouteLoadingChrome";

describe("BrandedLoadingState", () => {
  it("renders the driving-car loader with a polite status region", () => {
    render(
      <BrandedLoadingState
        label="Loading…"
        variant="page"
        ariaLabel="Loading page"
        reducedMotion
      />,
    );

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByLabelText("Loading page")).toBeInTheDocument();
    expect(screen.getByTestId("branded-loading-car")).toBeInTheDocument();
    expect(screen.getByTestId("branded-loading-car")).toHaveAttribute(
      "data-animated",
      "false",
    );
    expect(screen.queryByTestId("branded-loading-pin")).not.toBeInTheDocument();
    expect(document.querySelector(".branded-loading-car-animate")).toBeNull();
  });

  it("animates when reduced motion is off", () => {
    const { container } = render(
      <BrandedLoadingState label="Loading…" reducedMotion={false} />,
    );
    expect(container.querySelector(".branded-loading-car-animate")).not.toBeNull();
    expect(screen.getByTestId("branded-loading-car")).toHaveAttribute(
      "data-animated",
      "true",
    );
  });

  it("does not use the old bouncing parking-pin loader markup", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/brand/BrandedLoadingState.tsx"),
      "utf8",
    );
    expect(source).toContain("BrandedLoadingCar");
    expect(source).not.toContain("BrandedLoadingPin");
    expect(source).not.toContain("map-loading-pin");
    expect(source).not.toContain("map-loading-ring");
  });
});

describe("PageRouteLoadingChrome", () => {
  it("uses branded loading without skeleton pulse blocks", () => {
    render(<PageRouteLoadingChrome testId="profile-loading-shell" />);
    expect(screen.getByTestId("profile-loading-shell")).toBeInTheDocument();
    expect(screen.getByTestId("branded-loading-car")).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(
      screen.getByTestId("profile-loading-shell").querySelector(".animate-pulse"),
    ).toBeNull();
  });
});

describe("loader vs map pin and launch splash", () => {
  it("keeps actual map parking pins and launch logo separate from the car loader", () => {
    const picker = readFileSync(
      resolve(process.cwd(), "src/components/map/ParkingMapMapLibre.tsx"),
      "utf8",
    );
    const settle = readFileSync(
      resolve(process.cwd(), "src/components/illustrations/ParkingPinSettle.tsx"),
      "utf8",
    );
    const launch = readFileSync(
      resolve(process.cwd(), "src/components/shell/AppLaunchShell.tsx"),
      "utf8",
    );
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

    expect(picker).toContain("leaver-center-pin");
    expect(settle).toContain("parking-pin-settle");
    expect(launch).toContain('variant="splash"');
    expect(launch).not.toContain("BrandedLoadingCar");
    expect(css).toContain(".leaver-center-pin");
    expect(css).toContain(".branded-loading-car");
    expect(css).not.toContain(".map-loading-pin");
    expect(css).not.toContain("map-loading-pin-lift");
  });
});
