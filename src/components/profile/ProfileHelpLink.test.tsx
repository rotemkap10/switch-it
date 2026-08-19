import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProfileHelpLink } from "@/components/profile/ProfileHelpLink";

describe("ProfileHelpLink", () => {
  it("shows Help & Safety and routes to /help", () => {
    render(<ProfileHelpLink />);

    const link = screen.getByRole("link", { name: /Help & Safety/i });
    expect(link).toHaveAttribute("href", "/help");
    expect(link).toHaveAttribute("data-testid", "profile-help-link");
    expect(link.className).toContain("profile-action-row");
    expect(screen.getByTestId("help-info-icon")).toBeInTheDocument();
  });
});
