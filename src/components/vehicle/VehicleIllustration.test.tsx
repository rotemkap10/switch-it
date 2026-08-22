import { SIGNAL_BLUE } from "@/lib/branding/colors";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VehicleIllustration } from "@/components/vehicle/VehicleIllustration";
import { outlineForVehicleFill } from "@/lib/vehicle/illustration-silhouettes";
import { VEHICLE_TYPES } from "@/lib/vehicle/types";

describe("VehicleIllustration", () => {
  it("maps each vehicle type via data attribute", () => {
    for (const type of VEHICLE_TYPES) {
      const { unmount } = render(
        <VehicleIllustration
          vehicleType={type}
          vehicleColor="blue"
          animate={false}
        />,
      );

      expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
        "data-vehicle-type",
        type,
      );
      expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
        "data-silhouette",
        type,
      );
      unmount();
    }
  });

  it("renders distinct silhouettes for mini and van", () => {
    const { container: miniContainer } = render(
      <VehicleIllustration
        vehicleType="mini"
        vehicleColor="blue"
        animate={false}
      />,
    );
    const { container: vanContainer } = render(
      <VehicleIllustration
        vehicleType="van"
        vehicleColor="blue"
        animate={false}
      />,
    );

    const miniBody = miniContainer.querySelector('[data-part="body"]');
    const vanBody = vanContainer.querySelector('[data-part="body"]');
    expect(miniBody?.getAttribute("d")).not.toBe(vanBody?.getAttribute("d"));
  });

  it("uses the strict brand palette regardless of stored vehicle color", () => {
    const { container } = render(
      <VehicleIllustration
        vehicleType="sedan"
        vehicleColor="red"
        animate={false}
      />,
    );

    const illustration = screen.getByTestId("vehicle-illustration");
    expect(illustration).toHaveAttribute("data-vehicle-color", "red");

    const filledPath = container.querySelector(`path[fill="${SIGNAL_BLUE}"]`);
    expect(filledPath).not.toBeNull();
    expect(container.querySelector(`path[fill="#d45b5b"]`)).toBeNull();
  });

  it("preserves a visible outline for all vehicle colors", () => {
    const { container } = render(
      <VehicleIllustration
        vehicleType="sedan"
        vehicleColor="white"
        animate={false}
      />,
    );

    const stroke = outlineForVehicleFill("");
    expect(stroke).toBe(SIGNAL_BLUE);
    expect(
      container.querySelector(`path[stroke="${stroke}"]`),
    ).not.toBeNull();
  });

  it("keeps illustrations readable with brand blue outlines", () => {
    const { container } = render(
      <VehicleIllustration
        vehicleType="sedan"
        vehicleColor="black"
        animate={false}
      />,
    );

    const stroke = outlineForVehicleFill("");
    expect(stroke).toBe(SIGNAL_BLUE);
    expect(
      container.querySelector(`path[stroke="${stroke}"]`),
    ).not.toBeNull();
  });

  it("does not load external network images", () => {
    const { container } = render(
      <VehicleIllustration
        vehicleType="suv"
        vehicleColor="blue"
        animate={false}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(
      container.querySelector("image, [href^='http'], [xlink\\:href]"),
    ).toBeNull();
  });

  it("falls back to the other silhouette for unknown illustration keys", () => {
    render(
      <VehicleIllustration
        vehicleType="other"
        vehicleColor="gray"
        illustrationKey="unknown-future-asset"
        animate={false}
      />,
    );

    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-silhouette",
      "other",
    );
    expect(
      document.querySelector('[data-part="marker"]'),
    ).toBeInTheDocument();
  });

  it("exposes an accessible label when provided", () => {
    render(
      <VehicleIllustration
        vehicleType="suv"
        vehicleColor="white"
        label="White SUV"
        animate={false}
      />,
    );

    expect(screen.getByRole("img", { name: "White SUV" })).toBeInTheDocument();
  });

  it("renders a full-width hero showcase without cropping proportions", () => {
    render(
      <VehicleIllustration
        vehicleType="suv"
        vehicleColor="blue"
        size="hero"
        animate={false}
      />,
    );

    const illustration = screen.getByTestId("vehicle-illustration");
    expect(illustration).toHaveAttribute("data-size", "hero");
    expect(illustration.querySelector("svg")).toHaveAttribute(
      "preserveAspectRatio",
      "xMidYMid meet",
    );
  });

  it("renders a centered handoff identity size without cropping proportions", () => {
    render(
      <VehicleIllustration
        vehicleType="suv"
        vehicleColor="blue"
        size="handoff"
        animate={false}
      />,
    );

    const illustration = screen.getByTestId("vehicle-illustration");
    expect(illustration).toHaveAttribute("data-size", "handoff");
    expect(illustration).toHaveClass("w-[12.5rem]", "bg-transparent");
    expect(illustration).not.toHaveClass("rounded-[var(--radius-card)]");
    expect(illustration).not.toHaveClass("bg-accent-soft");
    expect(illustration).not.toHaveClass("h-[10.5rem]");
    expect(illustration.querySelector("svg")).toHaveAttribute(
      "preserveAspectRatio",
      "xMidYMid meet",
    );
  });
});
