import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/vehicle/VehicleIdentityCard", () => ({
  VehicleIdentityCard: () => <div data-testid="vehicle-identity-card" />,
}));

import { HandoffVehicleSection } from "@/components/vehicle/HandoffVehicleSection";

describe("HandoffVehicleSection", () => {
  it("shows the fallback for incomplete vehicles", () => {
    render(
      <HandoffVehicleSection
        title="Look for this vehicle"
        vehicle={{
          licensePlate: null,
          make: null,
          model: null,
          color: null,
          type: null,
        }}
      />,
    );

    expect(screen.getByText("Look for this vehicle")).toBeInTheDocument();
    expect(screen.getByTestId("handoff-vehicle-fallback")).toHaveTextContent(
      "Vehicle details not added yet",
    );
    expect(screen.queryByTestId("vehicle-identity-card")).not.toBeInTheDocument();
  });

  it("renders the identity card for complete vehicles", () => {
    render(
      <HandoffVehicleSection
        title="Arriving vehicle"
        vehicle={{
          licensePlate: "1234567",
          make: "Mazda",
          model: "3",
          color: "red",
          type: "hatchback",
        }}
      />,
    );

    expect(screen.getByText("Arriving vehicle")).toBeInTheDocument();
    expect(screen.getByTestId("vehicle-identity-card")).toBeInTheDocument();
    expect(
      screen.queryByTestId("handoff-vehicle-fallback"),
    ).not.toBeInTheDocument();
  });
});
