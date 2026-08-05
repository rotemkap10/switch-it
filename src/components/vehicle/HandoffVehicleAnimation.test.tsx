import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/vehicle/VehicleIllustration", () => ({
  VehicleIllustration: ({
    vehicleType,
    vehicleColor,
  }: {
    vehicleType: string;
    vehicleColor: string;
  }) => (
    <div
      data-testid="vehicle-illustration"
      data-vehicle-type={vehicleType}
      data-vehicle-color={vehicleColor}
    />
  ),
}));

import { HandoffVehicleAnimation } from "@/components/vehicle/HandoffVehicleAnimation";

describe("HandoffVehicleAnimation", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  it("receives vehicle type and color and renders the destination marker", () => {
    render(
      <HandoffVehicleAnimation vehicleType="suv" vehicleColor="white" />,
    );

    const animation = screen.getByTestId("handoff-vehicle-animation");
    expect(animation).toBeInTheDocument();
    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-vehicle-type",
      "suv",
    );
    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-vehicle-color",
      "white",
    );
    expect(screen.getByTestId("handoff-approach-marker")).toBeInTheDocument();
    expect(animation).toHaveAttribute("aria-hidden", "true");
  });

  it("uses a single-play animation class when motion is allowed", () => {
    const matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" ? false : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.stubGlobal("matchMedia", matchMedia);

    render(
      <HandoffVehicleAnimation vehicleType="sedan" vehicleColor="blue" />,
    );

    const vehicle = document.querySelector(".handoff-approach-vehicle");
    expect(vehicle).toHaveClass("motion-handoff-approach");
    expect(vehicle).not.toHaveClass("handoff-approach-vehicle-static");
  });

  it("shows the final state immediately when reduced motion is preferred", async () => {
    const listeners: Array<() => void> = [];
    const matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: (_event: string, listener: () => void) => {
        listeners.push(listener);
      },
      removeEventListener: vi.fn(),
    }));
    vi.stubGlobal("matchMedia", matchMedia);

    render(
      <HandoffVehicleAnimation vehicleType="mini" vehicleColor="black" />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("handoff-vehicle-animation")).toHaveAttribute(
        "data-reduced-motion",
        "true",
      );
    });

    const vehicle = document.querySelector(".handoff-approach-vehicle");
    expect(vehicle).toHaveClass("handoff-approach-vehicle-static");
    expect(vehicle).not.toHaveClass("motion-handoff-approach");
  });
});
