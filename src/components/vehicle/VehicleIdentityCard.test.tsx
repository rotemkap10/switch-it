import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/vehicle/VehicleIllustration", () => ({
  VehicleIllustration: ({
    label,
    vehicleType,
    vehicleColor,
  }: {
    label?: string;
    vehicleType: string;
    vehicleColor: string;
  }) => (
    <div
      data-testid="vehicle-illustration"
      data-vehicle-type={vehicleType}
      data-vehicle-color={vehicleColor}
      aria-label={label}
      role="img"
    />
  ),
}));

import { VehicleIdentityCard } from "@/components/vehicle/VehicleIdentityCard";

const completeVehicle = {
  licensePlate: "12345678",
  make: "Hyundai",
  model: "Tucson",
  color: "white" as const,
  type: "suv" as const,
};

describe("VehicleIdentityCard", () => {
  it("renders type, color, make, model, and formatted plate", () => {
    render(<VehicleIdentityCard vehicle={completeVehicle} />);

    expect(screen.getByTestId("vehicle-identity-card")).toBeInTheDocument();
    expect(screen.getByText("White SUV")).toBeInTheDocument();
    expect(screen.getByText("Hyundai Tucson")).toBeInTheDocument();
    expect(screen.getByText("123-45-678")).toBeInTheDocument();
  });

  it("exposes an accessible label with plate", () => {
    render(<VehicleIdentityCard vehicle={completeVehicle} />);

    expect(
      screen.getByRole("img", {
        name: "White Hyundai Tucson, license plate 123-45-678",
      }),
    ).toBeInTheDocument();
  });

  it("renders nothing for incomplete vehicles", () => {
    const { container } = render(
      <VehicleIdentityCard
        vehicle={{
          licensePlate: null,
          make: null,
          model: null,
          color: null,
          type: null,
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
