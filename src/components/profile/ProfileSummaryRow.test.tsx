import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileSummaryRow } from "@/components/profile/ProfileSummaryRow";
import { resetOneShotAnimationsForTests } from "@/lib/motion/one-shot";

const vehicle = {
  license_plate: "1234567",
  vehicle_make: "Hyundai",
  vehicle_model: "Tucson",
  vehicle_color: "white",
  vehicle_type: "suv",
};

describe("ProfileSummaryRow", () => {
  beforeEach(() => {
    resetOneShotAnimationsForTests();
    vi.stubGlobal("sessionStorage", {
      store: new Map<string, string>(),
      getItem(key: string) {
        return this.store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        this.store.set(key, value);
      },
    });
  });

  it("renders three equal summary cards without duplicating the large vehicle art", () => {
    render(
      <ProfileSummaryRow
        email="driver@example.com"
        credits={4}
        vehicleComplete
        vehicle={vehicle}
      />,
    );

    const row = screen.getByTestId("profile-summary-row");
    expect(row.className).toContain("sm:grid-cols-3");
    expect(screen.getByText("Vehicle ready")).toBeInTheDocument();
    expect(screen.getByTestId("vehicle-top-summary")).toHaveTextContent(
      "White SUV",
    );
    expect(screen.getByTestId("vehicle-top-summary")).toHaveTextContent(
      "12-345-67",
    );
    expect(screen.queryByTestId("vehicle-illustration")).not.toBeInTheDocument();
    expect(screen.getByTestId("check-mark-icon")).toBeInTheDocument();
  });
});
