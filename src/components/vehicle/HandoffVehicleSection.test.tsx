import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/vehicle/HandoffVehicleAnimation", () => ({
  HandoffVehicleAnimation: ({
    vehicleType,
    vehicleColor,
  }: {
    vehicleType: string;
    vehicleColor: string;
  }) => (
    <div
      data-testid="handoff-vehicle-animation"
      data-vehicle-type={vehicleType}
      data-vehicle-color={vehicleColor}
    />
  ),
}));

const sessionStore = new Map<string, string>();

beforeEach(() => {
  sessionStore.clear();
  resetSessionHandoffAnimationForTests();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => sessionStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      sessionStore.set(key, value);
    },
    removeItem: (key: string) => {
      sessionStore.delete(key);
    },
    clear: () => {
      sessionStore.clear();
    },
    key: () => null,
    length: 0,
  });
});

import { HandoffVehicleSection } from "@/components/vehicle/HandoffVehicleSection";
import { resetSessionHandoffAnimationForTests } from "@/components/vehicle/useSessionHandoffAnimation";

const completeVehicle = {
  licensePlateMasked: "12-345-**",
  make: "Mazda",
  model: "3",
  color: "red" as const,
  type: "hatchback" as const,
};

describe("HandoffVehicleSection", () => {
  it("shows the fallback for incomplete vehicles", () => {
    render(
      <HandoffVehicleSection
        title="Look for this vehicle"
        vehicle={{
          licensePlateMasked: null,
          make: null,
          model: null,
          color: null,
          type: null,
        }}
      />,
    );

    expect(screen.getByText("Look for this vehicle")).toBeInTheDocument();
    expect(screen.getByTestId("handoff-vehicle-fallback")).toHaveTextContent(
      "Vehicle details not added yet",
    );
    expect(screen.queryByTestId("vehicle-identity-card")).not.toBeInTheDocument();
  });

  it("renders the identity card without helper prose by default", () => {
    render(
      <HandoffVehicleSection title="Arriving vehicle" vehicle={completeVehicle} />,
    );

    expect(screen.getByText("Arriving vehicle")).toBeInTheDocument();
    expect(screen.getByTestId("vehicle-identity-card")).toBeInTheDocument();
    expect(
      screen.queryByText("This is the driver coming to your spot."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("handoff-vehicle-fallback"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("handoff-reciprocal-line"),
    ).not.toBeInTheDocument();
  });

  it("plays the approach animation once per session key", () => {
    const { unmount } = render(
      <HandoffVehicleSection
        title="Arriving vehicle"
        vehicle={completeVehicle}
        approachAnimationKey="publisher-spot-1"
      />,
    );

    expect(screen.getByTestId("handoff-vehicle-animation")).toBeInTheDocument();

    unmount();

    render(
      <HandoffVehicleSection
        title="Arriving vehicle"
        vehicle={completeVehicle}
        approachAnimationKey="publisher-spot-1"
      />,
    );

    expect(
      screen.queryByTestId("handoff-vehicle-animation"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("vehicle-identity-card")).toBeInTheDocument();
  });
});
