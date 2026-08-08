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
    expect(screen.getByText("White · 123-45-678")).toBeInTheDocument();
    expect(screen.getByText("Hyundai Tucson")).toBeInTheDocument();
    expect(screen.getByText("123-45-678")).toBeInTheDocument();
    expect(screen.getByTestId("vehicle-illustration")).toBeInTheDocument();
    expect(screen.queryByTestId("vehicle-photo")).not.toBeInTheDocument();
    expect(screen.getByTestId("vehicle-identity-plate")).toHaveClass(
      "vehicle-plate-display",
    );
  });

  it("shows the claimant photo when a signed url is present", () => {
    render(
      <VehicleIdentityCard
        vehicle={{
          ...completeVehicle,
          photoUrl: "https://example.test/seeker-car.jpg",
        }}
      />,
    );

    expect(screen.getByTestId("vehicle-photo")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Hyundai Tucson" })).toHaveAttribute(
      "src",
      "https://example.test/seeker-car.jpg",
    );
    expect(screen.getByText("Hyundai Tucson")).toBeInTheDocument();
    expect(screen.getByText("White · 123-45-678")).toBeInTheDocument();
    expect(screen.queryByTestId("vehicle-illustration")).not.toBeInTheDocument();
  });

  it("truncates long make and model text", () => {
    render(
      <VehicleIdentityCard
        vehicle={{
          ...completeVehicle,
          make: "Very Long Manufacturer Name",
          model: "Extremely Long Model Name Edition",
        }}
      />,
    );

    const makeModel = screen.getByTestId("vehicle-identity-make-model");
    expect(makeModel).toHaveClass("truncate");
    expect(makeModel).toHaveAttribute(
      "title",
      "Very Long Manufacturer Name Extremely Long Model Name Edition",
    );
  });

  it("exposes an accessible label with plate", () => {
    render(<VehicleIdentityCard vehicle={completeVehicle} />);

    expect(
      screen.getByText("White Hyundai Tucson, license plate 123-45-678"),
    ).toHaveClass("sr-only");
  });

  it("does not show representative illustration copy", () => {
    render(<VehicleIdentityCard vehicle={completeVehicle} />);

    expect(
      screen.queryByText("Vehicle illustration is representative."),
    ).not.toBeInTheDocument();
  });

  it("title-cases stored make and model for display only", () => {
    render(
      <VehicleIdentityCard
        vehicle={{
          ...completeVehicle,
          make: "toyota",
          model: "corola",
        }}
      />,
    );

    expect(screen.getByTestId("vehicle-identity-make-model")).toHaveTextContent(
      "Toyota Corola",
    );
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
