import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VehicleIllustration } from "@/components/vehicle/VehicleIllustration";
import { VEHICLE_COLOR_FILL } from "@/lib/vehicle/colors";
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
      unmount();
    }
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
});
