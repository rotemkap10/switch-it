import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    expect(screen.queryByText("Add a photo of your car")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add photo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change photo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove photo" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("vehicle-photo-controls")).not.toBeInTheDocument();
    expect(screen.getByText("Start finding parking")).toBeInTheDocument();
    expect(screen.getByLabelText("Manufacturer")).toHaveClass("app-form-control");
    expect(screen.getByLabelText("Manufacturer")).toHaveAttribute("role", "combobox");
    expect(screen.getByLabelText("Manufacturer")).toHaveAttribute(
      "placeholder",
      "Select manufacturer",
    );
    expect(screen.queryByLabelText("Vehicle type")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Model")).toBeDisabled();
    expect(screen.getByLabelText("Model")).toHaveAttribute(
      "placeholder",
      "Select manufacturer first",
    );
    expect(
      screen.getByRole("button", { name: "Can't find your manufacturer?" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Vehicle year")).toHaveClass("app-form-control");
    expect(screen.getByLabelText("License plate")).toHaveAttribute(
      "inputmode",
      "numeric",
    );
    expect(screen.getByLabelText("License plate")).toHaveAttribute(
      "placeholder",
      "e.g. 12-345-67",
    );
    expect(screen.getByLabelText("License plate")).toHaveClass("app-form-control");
    expect(screen.queryByRole("link", { name: /skip/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Save vehicle/i)).not.toBeInTheDocument();
  });

  it("opens manufacturer options on focus using the shared combobox", async () => {
    const user = userEvent.setup();
    render(
      <FeedbackShell>
        <OnboardingVehicleForm initialVehicle={emptyVehicle} />
      </FeedbackShell>,
    );

    await user.click(screen.getByLabelText("Manufacturer"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Toyota" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Hyundai" })).toBeInTheDocument();
  });
});
