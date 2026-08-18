import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VehicleModelImage } from "@/components/vehicle/VehicleModelImage";
import { CARIMAGES_LOADER_ERROR_EVENT } from "@/lib/vehicle/carimages";
import { resetCarImagesOutcomeCacheForTests } from "@/lib/vehicle/carimages-outcome-cache";

const TUCSON_CDN =
  "https://cdn.carimagesapi.com/vehicles/hyundai/tucson/nx4-2024-now-800-wm.webp";
const COROLLA_SIGNED =
  "https://carimagesapi.com/image?make=Toyota&model=Corolla&year=2024";

function renderModel(props: {
  make?: string;
  model?: string;
  year?: number;
  alt?: string;
  size?: "default" | "compact" | "handoff" | "hero";
}) {
  return render(
    <VehicleModelImage
      make={props.make ?? "Hyundai"}
      model={props.model ?? "Tucson"}
      year={props.year}
      alt={props.alt ?? "Hyundai Tucson"}
      size={props.size}
    >
      <div data-testid="vehicle-illustration">fallback</div>
    </VehicleModelImage>,
  );
}

function resolveCatalogImage(img: HTMLElement, src: string) {
  img.setAttribute("src", src);
  img.setAttribute("data-ci-loaded", "true");
  fireEvent.load(img);
}

describe("VehicleModelImage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetCarImagesOutcomeCacheForTests();
  });

  it("renders only the generic fallback when the public key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "");

    renderModel({ year: 2025 });

    expect(screen.getByTestId("vehicle-illustration")).toBeVisible();
    expect(screen.queryByTestId("vehicle-model-image")).not.toBeInTheDocument();
  });

  it("does not show the generic illustration while a catalog image is still loading", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    renderModel({ year: 2025, size: "handoff" });

    const img = screen.getByTestId("vehicle-model-image");
    expect(img).toHaveAttribute("data-ci-make", "Hyundai");
    expect(img).toHaveAttribute("data-ci-model", "Tucson");
    expect(img).toHaveAttribute("data-ci-year", "2025");
    expect(img).toHaveAttribute("data-ci-view", "front34");
    expect(img).toHaveAttribute("data-ci-format", "webp");
    expect(img).toHaveAttribute("fetchpriority", "high");
    expect(screen.getByTestId("vehicle-illustration")).not.toBeVisible();
    expect(screen.getByTestId("vehicle-model-image-frame")).toHaveAttribute(
      "data-status",
      "pending",
    );
    expect(screen.getByTestId("vehicle-model-image-frame")).toHaveClass(
      "vehicle-model-image__pending--slot",
    );
    expect(screen.getByTestId("vehicle-model-image-root")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("shows the catalog image when the loader assigns a signed /image URL", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    renderModel({ make: "Toyota", model: "Corolla", year: 2024, alt: "Toyota Corolla" });

    const img = screen.getByTestId("vehicle-model-image");
    resolveCatalogImage(img, COROLLA_SIGNED);

    expect(screen.getByTestId("vehicle-model-image-frame")).toHaveAttribute(
      "data-status",
      "ready",
    );
    expect(screen.getByRole("img", { name: "Toyota Corolla" })).toBe(img);
    expect(screen.getByTestId("vehicle-illustration")).not.toBeVisible();
  });

  it("shows the catalog image when the loader points at a CDN vehicle URL", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    renderModel({ year: 2025 });

    const img = screen.getByTestId("vehicle-model-image");
    resolveCatalogImage(img, TUCSON_CDN);

    expect(screen.getByTestId("vehicle-model-image-frame")).toHaveAttribute(
      "data-status",
      "ready",
    );
    expect(screen.getByRole("img", { name: "Hyundai Tucson" })).toBe(img);
    expect(screen.getByTestId("vehicle-illustration")).not.toBeVisible();
  });

  it("shows the generic illustration only after the loader marks a genuine error", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    expect(() => {
      renderModel({});
      const img = screen.getByTestId("vehicle-model-image");
      img.setAttribute("data-ci-loaded", "error");
      fireEvent.error(img);
    }).not.toThrow();

    expect(screen.getByTestId("vehicle-model-image-frame")).toHaveAttribute(
      "data-status",
      "fallback",
    );
    expect(screen.getByTestId("vehicle-illustration")).toBeVisible();
  });

  it("falls back when the CarImages loader script fails to load", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    renderModel({ year: 2025 });
    act(() => {
      window.dispatchEvent(new Event(CARIMAGES_LOADER_ERROR_EVENT));
    });

    expect(screen.getByTestId("vehicle-model-image-frame")).toHaveAttribute(
      "data-status",
      "fallback",
    );
    expect(screen.getByTestId("vehicle-illustration")).toBeVisible();
  });

  it("keeps a resolved catalog image across remounts of the same vehicle", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    const { unmount } = renderModel({ year: 2025, size: "handoff" });
    resolveCatalogImage(screen.getByTestId("vehicle-model-image"), TUCSON_CDN);
    unmount();

    renderModel({ year: 2025, size: "handoff" });

    expect(screen.getByTestId("vehicle-model-image-frame")).toHaveAttribute(
      "data-status",
      "ready",
    );
    expect(screen.getByTestId("vehicle-illustration")).not.toBeVisible();
    expect(screen.getByTestId("vehicle-model-image")).toHaveAttribute(
      "src",
      TUCSON_CDN,
    );
  });

  it("keeps a genuine fallback across remounts after a loader error", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    const { unmount } = renderModel({ year: 2025 });
    const img = screen.getByTestId("vehicle-model-image");
    img.setAttribute("data-ci-loaded", "error");
    fireEvent.error(img);
    unmount();

    renderModel({ year: 2025 });

    expect(screen.getByTestId("vehicle-model-image-frame")).toHaveAttribute(
      "data-status",
      "fallback",
    );
    expect(screen.getByTestId("vehicle-illustration")).toBeVisible();
  });

  it("omits data-ci-year when the profile has no year", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");

    renderModel({});

    const img = screen.getByTestId("vehicle-model-image");
    expect(img).toHaveAttribute("data-ci-make", "Hyundai");
    expect(img).toHaveAttribute("data-ci-model", "Tucson");
    expect(img).not.toHaveAttribute("data-ci-year");
    expect(screen.getByTestId("vehicle-illustration")).not.toBeVisible();
  });
});
