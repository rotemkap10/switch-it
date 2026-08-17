import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VehicleModelImage } from "@/components/vehicle/VehicleModelImage";

describe("VehicleModelImage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders only the generic fallback when the public key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "");

    render(
      <VehicleModelImage make="Hyundai" model="Tucson" year={2025} alt="Hyundai Tucson">
        <div data-testid="vehicle-illustration">fallback</div>
      </VehicleModelImage>,
    );

    expect(screen.getByTestId("vehicle-illustration")).toBeInTheDocument();
    expect(screen.queryByTestId("vehicle-model-image")).not.toBeInTheDocument();
  });

  it("keeps the generic fallback until CarImages reports a catalog image", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    render(
      <VehicleModelImage make="Hyundai" model="Tucson" year={2025} alt="Hyundai Tucson">
        <div data-testid="vehicle-illustration">fallback</div>
      </VehicleModelImage>,
    );

    const img = screen.getByTestId("vehicle-model-image");
    expect(img).toHaveAttribute("data-ci-make", "Hyundai");
    expect(img).toHaveAttribute("data-ci-model", "Tucson");
    expect(img).toHaveAttribute("data-ci-year", "2025");
    expect(img).toHaveAttribute("data-ci-view", "front34");
    expect(img).toHaveAttribute("data-ci-format", "webp");
    expect(screen.getByTestId("vehicle-illustration")).toBeInTheDocument();
    expect(screen.getByTestId("vehicle-model-image-frame")).toHaveAttribute(
      "data-status",
      "pending",
    );
  });

  it("shows the catalog image when the loader assigns a signed /image URL", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    render(
      <VehicleModelImage make="Toyota" model="Corolla" year={2024} alt="Toyota Corolla">
        <div data-testid="vehicle-illustration">fallback</div>
      </VehicleModelImage>,
    );

    const img = screen.getByTestId("vehicle-model-image");
    img.setAttribute(
      "src",
      "https://carimagesapi.com/image?make=Toyota&model=Corolla&year=2024",
    );
    img.setAttribute("data-ci-loaded", "true");
    fireEvent.load(img);

    expect(screen.getByTestId("vehicle-model-image-frame")).toHaveAttribute(
      "data-status",
      "ready",
    );
    expect(screen.getByRole("img", { name: "Toyota Corolla" })).toBe(img);
    expect(screen.getByTestId("vehicle-illustration")).not.toBeVisible();
  });

  it("shows the catalog image when the loader points at a CDN vehicle URL", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    render(
      <VehicleModelImage make="Hyundai" model="Tucson" year={2025} alt="Hyundai Tucson">
        <div data-testid="vehicle-illustration">fallback</div>
      </VehicleModelImage>,
    );

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
    expect(screen.getByRole("img", { name: "Hyundai Tucson" })).toBe(img);
    expect(screen.getByTestId("vehicle-illustration")).not.toBeVisible();
  });

  it("keeps the generic fallback when the loader marks the image as an error", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    render(
      <VehicleModelImage make="Hyundai" model="Tucson" alt="Hyundai Tucson">
        <div data-testid="vehicle-illustration">fallback</div>
      </VehicleModelImage>,
    );

    const img = screen.getByTestId("vehicle-model-image");
    img.setAttribute("data-ci-loaded", "error");
    fireEvent.error(img);

    expect(screen.getByTestId("vehicle-model-image-frame")).toHaveAttribute(
      "data-status",
      "fallback",
    );
    expect(screen.getByTestId("vehicle-illustration")).toBeVisible();
  });

  it("omits data-ci-year when the profile has no year", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    render(
      <VehicleModelImage make="Hyundai" model="Tucson" alt="Hyundai Tucson">
        <div data-testid="vehicle-illustration">fallback</div>
      </VehicleModelImage>,
    );

    const img = screen.getByTestId("vehicle-model-image");
    expect(img).toHaveAttribute("data-ci-make", "Hyundai");
    expect(img).toHaveAttribute("data-ci-model", "Tucson");
    expect(img).not.toHaveAttribute("data-ci-year");
    expect(screen.getByTestId("vehicle-illustration")).toBeInTheDocument();
  });
});
