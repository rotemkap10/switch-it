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

import { VehicleImage } from "@/components/vehicle/VehicleImage";

describe("VehicleImage", () => {
  it("shows the uploaded photo when a url is present", () => {
    render(
      <VehicleImage
        photoUrl="https://example.test/car.jpg"
        vehicleType="suv"
        vehicleColor="white"
        label="White SUV"
        size="hero"
      />,
    );

    const photo = screen.getByTestId("vehicle-photo");
    expect(photo).toHaveAttribute("data-size", "hero");
    expect(screen.getByRole("img", { name: "White SUV" })).toHaveAttribute(
      "src",
      "https://example.test/car.jpg",
    );
    expect(screen.queryByTestId("vehicle-illustration")).not.toBeInTheDocument();
  });

  it("falls back to the illustration when there is no photo", () => {
    render(
      <VehicleImage
        vehicleType="suv"
        vehicleColor="white"
        size="compact"
        label="White SUV"
      />,
    );

    expect(screen.queryByTestId("vehicle-photo")).not.toBeInTheDocument();
    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-vehicle-type",
      "suv",
    );
    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-size",
      "compact",
    );
  });

  it("uses the placeholder illustration before type and color are chosen", () => {
    render(<VehicleImage placeholderPreview size="hero" />);

    expect(screen.getByTestId("vehicle-illustration-placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-vehicle-type",
      "sedan",
    );
  });
});
