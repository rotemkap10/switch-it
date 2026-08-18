import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
import { resetCarImagesOutcomeCacheForTests } from "@/lib/vehicle/carimages-outcome-cache";

const completeVehicle = {
  licensePlateMasked: "123-45-6**",
  make: "Hyundai",
  model: "Tucson",
  color: "white" as const,
  type: "suv" as const,
};

describe("VehicleIdentityCard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetCarImagesOutcomeCacheForTests();
  });

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

  it("uses CarImages or the generic illustration, never an uploaded photo", () => {
    render(<VehicleIdentityCard vehicle={completeVehicle} />);

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

  it("does not show the generic illustration while the handoff catalog image is loading", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    render(
      <VehicleIdentityCard
        vehicle={{
          ...completeVehicle,
          year: 2025,
        }}
      />,
    );

    expect(screen.getByTestId("vehicle-model-image-frame")).toHaveAttribute(
      "data-status",
      "pending",
    );
    expect(screen.getByTestId("vehicle-model-image-frame")).toHaveAttribute(
      "data-size",
      "handoff",
    );
    expect(screen.getByTestId("vehicle-illustration")).not.toBeVisible();
    expect(screen.getByTestId("vehicle-model-image")).toHaveAttribute(
      "fetchpriority",
      "high",
    );
  });

  it("reveals the catalog image without first treating the illustration as the vehicle", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    render(
      <VehicleIdentityCard
        vehicle={{
          ...completeVehicle,
          year: 2025,
        }}
      />,
    );

    expect(screen.getByTestId("vehicle-illustration")).not.toBeVisible();

    const img = screen.getByTestId("vehicle-model-image");
    img.setAttribute(
      "src",
      "https://cdn.carimagesapi.com/vehicles/hyundai/tucson/nx4-2024-now-800-wm.webp",
    );
    img.setAttribute("data-ci-loaded", "true");
    fireEvent.load(img);

    expect(screen.getByTestId("vehicle-model-image-frame")).toHaveAttribute(
      "data-status",
      "ready",
    );
    expect(screen.getByTestId("vehicle-illustration")).not.toBeVisible();
    expect(screen.getByRole("img", { name: "Hyundai Tucson · 2025" })).toBe(img);
  });
});
