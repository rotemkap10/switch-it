import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/onboarding", () => ({
  completeVehicleOnboarding: vi.fn(),
}));

import { FeedbackShell } from "@/components/feedback/FeedbackShell";
import { OnboardingVehicleForm } from "@/components/onboarding/OnboardingVehicleForm";

const emptyVehicle = {
  license_plate: null,
  vehicle_make: null,
  vehicle_model: null,
  vehicle_color: null,
  vehicle_type: null,
};

describe("OnboardingVehicleForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders step-two fields with a hero illustration and no skip action", () => {
    render(
      <FeedbackShell>
        <OnboardingVehicleForm initialVehicle={emptyVehicle} />
      </FeedbackShell>,
    );

    expect(screen.getByTestId("onboarding-vehicle-form")).toHaveClass(
      "onboarding-vehicle-form",
    );
    expect(screen.getByTestId("vehicle-illustration-placeholder")).toBeInTheDocument();
    expect(screen.getByText("Continue to the map")).toBeInTheDocument();
    expect(screen.getByLabelText("Vehicle type")).toBeInTheDocument();
    expect(screen.getByLabelText("License plate")).toHaveAttribute(
      "inputmode",
      "numeric",
    );
    expect(screen.queryByRole("link", { name: /skip/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Save vehicle/i)).not.toBeInTheDocument();
  });
});
