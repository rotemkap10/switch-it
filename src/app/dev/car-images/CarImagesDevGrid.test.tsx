import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CarImagesDevGrid } from "@/app/dev/car-images/CarImagesDevGrid";
import { CARIMAGES_DEV_TEST_VEHICLES } from "@/lib/vehicle/carimages-test-vehicles";

describe("CarImagesDevGrid", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes make, model, and year to the CarImages loader for each sample", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    render(<CarImagesDevGrid />);

    const images = screen.getAllByTestId("vehicle-model-image");
    expect(images).toHaveLength(CARIMAGES_DEV_TEST_VEHICLES.length + 1);

    for (const [index, vehicle] of CARIMAGES_DEV_TEST_VEHICLES.entries()) {
      expect(images[index]).toHaveAttribute("data-ci-make", vehicle.make);
      expect(images[index]).toHaveAttribute("data-ci-model", vehicle.model);
      expect(images[index]).toHaveAttribute(
        "data-ci-year",
        String(vehicle.year),
      );
    }
  });
});
