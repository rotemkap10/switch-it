import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VehicleIllustration } from "@/components/vehicle/VehicleIllustration";
import { VEHICLE_COLOR_FILL } from "@/lib/vehicle/colors";
import { outlineForVehicleFill } from "@/lib/vehicle/illustration-silhouettes";
import { VEHICLE_TYPES } from "@/lib/vehicle/types";

describe("VehicleIllustration", () => {
  it("maps each vehicle type via data attribute", () => {
    for (const type of VEHICLE_TYPES) {
      const { unmount } = render(
        <VehicleIllustration
          vehicleType={type}
          vehicleColor="blue"
          animate={false}
        />,
      );

      expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
        "data-vehicle-type",
        type,
      );
      expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
        "data-silhouette",
        type,
      );
      unmount();
    }
  });

  it("renders distinct silhouettes for mini and van", () => {
    const { container: miniContainer } = render(
      <VehicleIllustration
        vehicleType="mini"
        vehicleColor="blue"
        animate={false}
      />,
    );
    const { container: vanContainer } = render(
      <VehicleIllustration
        vehicleType="van"
        vehicleColor="blue"
        animate={false}
      />,
    );

    const miniBody = miniContainer.querySelector('[data-part="body"]');
    const vanBody = vanContainer.querySelector('[data-part="body"]');
    expect(miniBody?.getAttribute("d")).not.toBe(vanBody?.getAttribute("d"));
  });

  it("uses the controlled color fill from the palette", () => {
    const { container } = render(
      <VehicleIllustration
        vehicleType="sedan"
        vehicleColor="red"
        animate={false}
      />,
    );

    const illustration = screen.getByTestId("vehicle-illustration");
    expect(illustration).toHaveAttribute("data-vehicle-color", "red");

    const filledPath = container.querySelector(`path[fill="${VEHICLE_COLOR_FILL.red}"]`);
    expect(filledPath).not.toBeNull();
  });

  it("preserves a visible outline for light vehicle colors", () => {
    const { container } = render(
      <VehicleIllustration
        vehicleType="sedan"
        vehicleColor="white"
        animate={false}
      />,
    );

    const stroke = outlineForVehicleFill(VEHICLE_COLOR_FILL.white);
    expect(
      container.querySelector(`path[stroke="${stroke}"]`),
    ).not.toBeNull();
  });

  it("falls back to the other silhouette for unknown illustration keys", () => {
    render(
      <VehicleIllustration
        vehicleType="other"
        vehicleColor="gray"
        illustrationKey="unknown-future-asset"
        animate={false}
      />,
    );

    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-silhouette",
      "other",
    );
    expect(
      document.querySelector('[data-part="marker"]'),
    ).toBeInTheDocument();
  });

  it("exposes an accessible label when provided", () => {
    render(
      <VehicleIllustration
        vehicleType="suv"
        vehicleColor="white"
        label="White SUV"
        animate={false}
      />,
    );

    expect(screen.getByRole("img", { name: "White SUV" })).toBeInTheDocument();
  });

  it("renders a full-width hero showcase without cropping proportions", () => {
    render(
      <VehicleIllustration
        vehicleType="suv"
        vehicleColor="blue"
        size="hero"
        animate={false}
      />,
    );

    const illustration = screen.getByTestId("vehicle-illustration");
    expect(illustration).toHaveAttribute("data-size", "hero");
    expect(illustration.querySelector("svg")).toHaveAttribute(
      "preserveAspectRatio",
      "xMidYMid meet",
    );
  });
});
