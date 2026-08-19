import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/auth", () => ({
  logout: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/map",
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
    expect(
      screen.getByRole("menuitem", { name: "Help & Safety" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "History" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when clicking outside the menu", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">Outside</button>
        <ProfileMenu displayName="Alex" />
      </div>,
    );

    await user.click(
      screen.getByRole("button", { name: "Profile menu for Alex" }),
    );
    expect(screen.getByRole("menu", { name: "Account" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(
      screen.getByRole("button", { name: "Profile menu for Alex" }),
    ).toHaveAttribute("aria-expanded", "false");
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

  it("links Profile and Help & Safety then closes after a navigation item", async () => {
    const user = userEvent.setup();
    render(<ProfileMenu displayName="Alex" />);

    const trigger = screen.getByRole("button", {
      name: "Profile menu for Alex",
    });
    await user.click(trigger);

    const profile = screen.getByRole("menuitem", { name: "Profile" });
    expect(profile).toHaveAttribute("href", "/profile");
    const history = screen.getByRole("menuitem", { name: "History" });
    expect(history).toHaveAttribute("href", "/history");
    const help = screen.getByRole("menuitem", { name: "Help & Safety" });
    expect(help).toHaveAttribute("href", "/help");
    expect(help.className).toBe(history.className);
    expect(help.className).toBe(profile.className);
    expect(help.className).toContain("px-3");
    expect(help.className).toContain("min-h-[var(--app-tap-min)]");
    expect(help.className).not.toContain("flex");
    expect(screen.queryByTestId("help-info-icon")).not.toBeInTheDocument();

    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items.slice(0, 3)).toEqual(["Profile", "History", "Help & Safety"]);

    await user.click(help);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu", { name: "Account" })).not.toBeInTheDocument();
  });
});
