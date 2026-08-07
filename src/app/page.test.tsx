import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";
import { FEEDBACK_SUCCESS_KEYS } from "@/lib/feedback/success-keys";

describe("landing page", () => {
  it("leads with the brand and clear CTAs", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Switch It" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create account" }),
    ).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByText(/never sells or guarantees/i)).toBeInTheDocument();
  });
});

describe("Phase 10 terminal feedback copy", () => {
  it("uses clear completion and cancellation messages", () => {
    expect(FEEDBACK_SUCCESS_KEYS["handoff-completed"]).toContain(
      "Parking handoff complete",
    );
    expect(FEEDBACK_SUCCESS_KEYS["handoff-completed"]).toContain(
      "1 credit was used",
    );
    expect(FEEDBACK_SUCCESS_KEYS["handoff-cancelled-publisher"]).toContain(
      "Spot cancelled",
    );
    expect(FEEDBACK_SUCCESS_KEYS["claim-cancelled"]).toContain("Claim cancelled");
  });

  it("does not expose Phase 9C routing keys", () => {
    expect(
      Object.keys(FEEDBACK_SUCCESS_KEYS).some((key) =>
        /route|eta|google/i.test(key),
      ),
    ).toBe(false);
  });
});
