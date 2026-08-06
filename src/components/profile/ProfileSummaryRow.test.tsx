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

  it("uses the mobile summary grid with credits and vehicle on the first row", () => {
    render(
      <ProfileSummaryRow
        email="driver@example.com"
        credits={4}
        vehicleComplete
        vehicle={vehicle}
      />,
    );

    const row = screen.getByTestId("profile-summary-row");
    expect(row.className).toContain("profile-summary-grid");
    expect(row.querySelector(".profile-summary-email")).not.toBeNull();
    expect(screen.getByText("Vehicle ready")).toBeInTheDocument();
    expect(screen.getByTestId("vehicle-top-summary")).toHaveTextContent(
      "White SUV",
    );
    expect(screen.queryByTestId("vehicle-illustration")).not.toBeInTheDocument();
  });

  it("wraps long email safely without horizontal overflow classes", () => {
    render(
      <ProfileSummaryRow
        email="very.long.email.address.for.testing@example.com"
        credits={2}
        vehicleComplete={false}
        vehicle={vehicle}
      />,
    );

    const email = screen.getByTestId("profile-email-value");
    expect(email.className).toContain("break-all");
    expect(email).toHaveTextContent("very.long.email.address.for.testing@example.com");
  });
});
