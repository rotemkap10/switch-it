import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetCarImagesOutcomeCacheForTests } from "@/lib/vehicle/carimages-outcome-cache";

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
  afterEach(() => {
    vi.unstubAllEnvs();
    resetCarImagesOutcomeCacheForTests();
  });
  it("renders the catalog illustration path without an uploaded-photo element", () => {
    render(
      <VehicleImage
        vehicleType="suv"
        vehicleColor="white"
        label="White SUV"
        size="hero"
      />,
    );

    expect(screen.queryByTestId("vehicle-photo")).not.toBeInTheDocument();
    expect(screen.getByTestId("vehicle-illustration")).toBeInTheDocument();
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

  it("uses CarImages before the generic illustration", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    render(
      <VehicleImage
        vehicleType="suv"
        vehicleColor="white"
        make="Hyundai"
        model="Tucson"
        year={2025}
        label="White SUV"
        size="hero"
      />,
    );

    expect(screen.queryByTestId("vehicle-photo")).not.toBeInTheDocument();
    expect(screen.getByTestId("vehicle-model-image")).toHaveAttribute(
      "data-ci-make",
      "Hyundai",
    );
    expect(screen.getByTestId("vehicle-illustration")).not.toBeVisible();
    expect(screen.getByTestId("vehicle-model-image-frame")).toHaveAttribute(
      "data-status",
      "pending",
    );
  });

  it("sends canonical make and model to CarImages even when stored casing differs", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    render(
      <VehicleImage
        vehicleType="sedan"
        vehicleColor="white"
        make="toyota"
        model="corolla"
        year={2024}
        size="compact"
        label="White Sedan"
      />,
    );

    expect(screen.getByTestId("vehicle-model-image")).toHaveAttribute(
      "data-ci-make",
      "Toyota",
    );
    expect(screen.getByTestId("vehicle-model-image")).toHaveAttribute(
      "data-ci-model",
      "Corolla",
    );
    expect(screen.getByTestId("vehicle-model-image")).toHaveAttribute(
      "data-ci-year",
      "2024",
    );
  });

  it("asks CarImages for make and model", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    render(
      <VehicleImage
        vehicleType="suv"
        vehicleColor="white"
        make="Hyundai"
        model="Tucson"
        year={2025}
        size="compact"
        label="White SUV"
      />,
    );

    expect(screen.queryByTestId("vehicle-photo")).not.toBeInTheDocument();
    expect(screen.getByTestId("vehicle-illustration")).not.toBeVisible();
    expect(screen.getByTestId("vehicle-model-image")).toHaveAttribute(
      "data-ci-make",
      "Hyundai",
    );
    expect(screen.getByTestId("vehicle-model-image")).toHaveAttribute(
      "data-ci-view",
      "front34",
    );
    expect(screen.getByTestId("vehicle-model-image")).toHaveAttribute(
      "data-ci-year",
      "2025",
    );
  });

  it("asks CarImages for make and model only when year is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    render(
      <VehicleImage
        vehicleType="suv"
        vehicleColor="white"
        make="Hyundai"
        model="Tucson"
        size="compact"
        label="White SUV"
      />,
    );

    expect(screen.getByTestId("vehicle-illustration")).not.toBeVisible();
    expect(screen.getByTestId("vehicle-model-image")).toHaveAttribute(
      "data-ci-make",
      "Hyundai",
    );
    expect(screen.getByTestId("vehicle-model-image")).not.toHaveAttribute(
      "data-ci-year",
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

  it("derives the generic illustration class from make and model, not CarImages", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    render(
      <VehicleImage
        vehicleType="van"
        vehicleColor="white"
        make="Toyota"
        model="Corolla"
        year={2024}
        size="compact"
        label="White"
      />,
    );

    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-vehicle-type",
      "sedan",
    );
    expect(screen.getByTestId("vehicle-model-image")).toHaveAttribute(
      "data-ci-make",
      "Toyota",
    );
    expect(screen.getByTestId("vehicle-model-image")).toHaveAttribute(
      "data-ci-model",
      "Corolla",
    );
    expect(screen.getByTestId("vehicle-model-image")).toHaveAttribute(
      "data-ci-year",
      "2024",
    );
    expect(screen.getByTestId("vehicle-model-image")).toHaveAttribute(
      "data-ci-type",
      "car",
    );
  });

  it("uses a generic other silhouette for unknown models", () => {
    render(
      <VehicleImage
        vehicleColor="white"
        make="Koenigsegg"
        model="Jesko"
        size="compact"
        label="White"
      />,
    );

    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-vehicle-type",
      "other",
    );
  });
});
