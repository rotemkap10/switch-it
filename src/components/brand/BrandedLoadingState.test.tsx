import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandedLoadingState } from "@/components/brand/BrandedLoadingState";
import { PageRouteLoadingChrome } from "@/components/shell/PageRouteLoadingChrome";

describe("BrandedLoadingState", () => {
  it("renders the parking pin with a polite status region", () => {
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
    expect(screen.getByTestId("branded-loading-pin")).toBeInTheDocument();
    expect(
      document.querySelector(".map-loading-pin-animate"),
    ).toBeNull();
  });

  it("animates when reduced motion is off", () => {
    const { container } = render(
      <BrandedLoadingState label="Loading…" reducedMotion={false} />,
    );
    expect(container.querySelector(".map-loading-pin-animate")).not.toBeNull();
  });
});

describe("PageRouteLoadingChrome", () => {
  it("uses branded loading without skeleton pulse blocks", () => {
    render(<PageRouteLoadingChrome testId="profile-loading-shell" />);
    expect(screen.getByTestId("profile-loading-shell")).toBeInTheDocument();
    expect(screen.getByTestId("branded-loading-pin")).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(
      screen.getByTestId("profile-loading-shell").querySelector(".animate-pulse"),
    ).toBeNull();
  });
});
