import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/auth", () => ({
  logout: vi.fn(),
}));

import { ProfileMenu } from "@/components/layout/ProfileMenu";

describe("ProfileMenu", () => {
  it("toggles with aria-expanded and Escape closes", async () => {
    const user = userEvent.setup();
    render(<ProfileMenu displayName="Alex" />);

    const trigger = screen.getByRole("button", { name: "Profile menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
