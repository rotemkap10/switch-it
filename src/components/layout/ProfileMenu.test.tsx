import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/auth", () => ({
  logout: vi.fn(),
}));

const installState = vi.hoisted(() => ({
  showInstallEntry: false,
  requestInstallUi: vi.fn(),
  iosSheetOpen: false,
  closeIosSheet: vi.fn(),
}));

vi.mock("@/lib/pwa/use-pwa-install", () => ({
  usePwaInstall: () => installState,
}));

import { ProfileMenu } from "@/components/layout/ProfileMenu";

describe("ProfileMenu", () => {
  beforeEach(() => {
    installState.showInstallEntry = false;
    installState.requestInstallUi.mockReset();
    installState.iosSheetOpen = false;
    installState.closeIosSheet.mockReset();
  });

  it("toggles with aria-expanded and Escape closes", async () => {
    const user = userEvent.setup();
    render(<ProfileMenu displayName="Alex" />);

    const trigger = screen.getByRole("button", {
      name: "Profile menu for Alex",
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("user-initial-avatar")).toHaveAttribute(
      "data-initial",
      "A",
    );

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("shows Install app only when eligible", async () => {
    const user = userEvent.setup();
    installState.showInstallEntry = true;

    render(<ProfileMenu displayName="Alex" />);
    await user.click(screen.getByRole("button", { name: "Profile menu for Alex" }));

    const installItem = screen.getByRole("menuitem", { name: "Install app" });
    await user.click(installItem);
    expect(installState.requestInstallUi).toHaveBeenCalledTimes(1);
  });

  it("hides Install app when not eligible", async () => {
    const user = userEvent.setup();
    render(<ProfileMenu displayName="Alex" />);
    await user.click(screen.getByRole("button", { name: "Profile menu for Alex" }));

    expect(
      screen.queryByRole("menuitem", { name: "Install app" }),
    ).not.toBeInTheDocument();
  });
});
