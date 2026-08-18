import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProfileSummaryRow } from "@/components/profile/ProfileSummaryRow";

describe("ProfileSummaryRow", () => {
  it("shows credits and email in a two-card grid without a vehicle summary card", () => {
    render(
      <ProfileSummaryRow email="driver@example.com" credits={4} />,
    );

    const row = screen.getByTestId("profile-summary-row");
    expect(row.className).toContain("profile-summary-grid");
    expect(row.querySelectorAll(".profile-summary-card")).toHaveLength(2);
    expect(row.querySelector(".profile-summary-email")).toBeNull();
    expect(screen.getByTestId("credits-summary-card")).toBeInTheDocument();
    expect(screen.getByTestId("credits-balance")).toHaveTextContent("4 credits");
    expect(screen.getByTestId("profile-email-value")).toHaveTextContent(
      "driver@example.com",
    );
    expect(screen.queryByTestId("vehicle-top-summary")).not.toBeInTheDocument();
    expect(screen.queryByText("Vehicle")).not.toBeInTheDocument();
    expect(screen.queryByText("Vehicle ready")).not.toBeInTheDocument();
    expect(screen.queryByText("Setup required")).not.toBeInTheDocument();
  });

  it("wraps long email safely without horizontal overflow classes", () => {
    render(
      <ProfileSummaryRow
        email="very.long.email.address.for.testing@example.com"
        credits={2}
      />,
    );

    const email = screen.getByTestId("profile-email-value");
    expect(email.className).toContain("break-all");
    expect(email).toHaveTextContent(
      "very.long.email.address.for.testing@example.com",
    );
  });
});
