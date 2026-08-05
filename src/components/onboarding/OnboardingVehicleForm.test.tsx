import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { completeVehicleOnboardingMock } = vi.hoisted(() => ({
  completeVehicleOnboardingMock: vi.fn(),
}));

vi.mock("@/actions/onboarding", () => ({
  completeVehicleOnboarding: completeVehicleOnboardingMock,
}));

import { OnboardingVehicleForm } from "@/components/onboarding/OnboardingVehicleForm";

const emptyVehicle = {
  license_plate: null,
  vehicle_make: null,
  vehicle_model: null,
  vehicle_color: null,
  vehicle_type: null,
};

describe("OnboardingVehicleForm", () => {
  it("renders the onboarding fields without a skip action", () => {
    render(<OnboardingVehicleForm initialVehicle={emptyVehicle} />);

    expect(screen.getByText("Continue to the map")).toBeInTheDocument();
    expect(screen.getByLabelText("Vehicle type")).toBeInTheDocument();
    expect(screen.getByLabelText("License plate")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /skip/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Save vehicle/i)).not.toBeInTheDocument();
  });
});
