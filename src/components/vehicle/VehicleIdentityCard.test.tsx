import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/vehicle/VehicleIllustration", () => ({
  VehicleIllustration: ({
    label,
    vehicleType,
    vehicleColor,
    size,
  }: {
    label?: string;
    vehicleType: string;
    vehicleColor: string;
    size?: string;
  }) => (
    <div
      data-testid="vehicle-illustration"
      data-vehicle-type={vehicleType}
      data-vehicle-color={vehicleColor}
      data-size={size}
      aria-label={label}
      role="img"
    />
  ),
}));

import { VehicleIdentityCard } from "@/components/vehicle/VehicleIdentityCard";

const completeVehicle = {
  licensePlateMasked: "123-45-6**",
  make: "Hyundai",
  model: "Tucson",
  color: "white" as const,
  type: "suv" as const,
};

describe("VehicleIdentityCard", () => {
  it("renders type, color, make, model, and masked plate", () => {
    render(<VehicleIdentityCard vehicle={completeVehicle} />);

    expect(screen.getByTestId("vehicle-identity-card")).toBeInTheDocument();
    expect(screen.getByTestId("vehicle-identity-card")).toHaveAttribute(
      "data-layout",
      "stacked",
    );
    expect(screen.getByTestId("vehicle-identity-card")).toHaveAttribute(
      "data-presentation",
      "float",
    );
    expect(screen.getByTestId("vehicle-identity-color")).toHaveTextContent("White");
    expect(screen.getByText("Hyundai Tucson")).toBeInTheDocument();
    expect(screen.getByText("123-45-6**")).toBeInTheDocument();
    expect(screen.queryByText("123-45-678")).not.toBeInTheDocument();
    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-size",
      "handoff",
    );
    expect(screen.queryByTestId("vehicle-photo")).not.toBeInTheDocument();
    expect(screen.getByTestId("vehicle-identity-plate")).toHaveClass(
      "vehicle-plate-display",
    );
  });

  it("ignores an uploaded photo URL and keeps CarImages/illustration fallback", () => {
    render(
      <VehicleIdentityCard
        vehicle={{
          ...completeVehicle,
          // leftover field from older payloads
          ...({ photoUrl: "https://example.test/seeker-car.jpg" } as object),
        }}
      />,
    );

    expect(screen.queryByTestId("vehicle-photo")).not.toBeInTheDocument();
    expect(screen.getByTestId("vehicle-illustration")).toBeInTheDocument();
    expect(screen.getByText("Hyundai Tucson")).toBeInTheDocument();
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

  it("exposes an accessible label with the masked plate", () => {
    render(<VehicleIdentityCard vehicle={completeVehicle} />);

    expect(
      screen.getByText("White Hyundai Tucson, license plate 123-45-6**"),
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
          licensePlateMasked: null,
          make: null,
          model: null,
          color: null,
          type: null,
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows year with make and model when present", () => {
    render(
      <VehicleIdentityCard
        vehicle={{
          ...completeVehicle,
          year: 2025,
        }}
      />,
    );

    expect(screen.getByTestId("vehicle-identity-make-model")).toHaveTextContent(
      "Hyundai Tucson · 2025",
    );
    expect(
      screen.getByText("White Hyundai Tucson 2025, license plate 123-45-6**"),
    ).toHaveClass("sr-only");
  });
});
