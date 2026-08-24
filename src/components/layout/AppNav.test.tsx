import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigationState = vi.hoisted(() => ({
  pathname: "/map",
  push: vi.fn(),
}));

const modeState = vi.hoisted(() => ({
  mode: "seeker" as "seeker" | "leaver" | null,
  setMode: vi.fn(),
  ready: true,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useRouter: () => ({ push: navigationState.push }),
}));

vi.mock("@/components/mode/ModeProvider", () => ({
  useMode: () => ({
    mode: modeState.mode,
    ready: modeState.ready,
    setMode: modeState.setMode,
    homeFor: (m: string) => (m === "leaver" ? "/spots/new" : "/map"),
  }),
}));

vi.mock("@/actions/auth", () => ({
  logout: vi.fn(),
}));

import { AppNav } from "@/components/layout/AppNav";

describe("AppNav", () => {
  beforeEach(() => {
    navigationState.pathname = "/map";
    navigationState.push.mockReset();
    modeState.mode = "seeker";
    modeState.setMode.mockReset();
  });

  it("uses a two-row phone header: brand+profile, then ModeSwitch", () => {
    render(<AppNav displayName="Alex" />);

    const brandRow = screen.getByTestId("app-nav-row-brand");
    const modeRow = screen.getByTestId("app-nav-row-mode");
    expect(brandRow).toBeInTheDocument();
    expect(modeRow).toBeInTheDocument();
    expect(modeRow.className).toContain("md:hidden");

    expect(screen.getByRole("link", { name: "Switch It" })).toBeInTheDocument();
    expect(brandRow.querySelector("img")).toHaveAttribute(
      "src",
      "/branding/switch-it-logo.png",
    );
    expect(
      screen.getByRole("button", { name: "Profile menu for Alex" }),
    ).toBeInTheDocument();
    expect(modeRow.querySelector('[data-testid="mode-switch"]')).not.toBeNull();
  });

  it("keeps desktop ModeSwitch in the brand row", () => {
    render(<AppNav />);
    const desktop = screen.getByTestId("app-nav-mode-desktop");
    expect(desktop.className).toContain("hidden");
    expect(desktop.className).toContain("md:block");
    expect(desktop.querySelector('[data-testid="mode-switch"]')).not.toBeNull();
  });

  it("shows Find parking and Share a spot without legacy labels or tabs", () => {
    render(<AppNav displayName="Alex" />);

    expect(
      screen.getAllByRole("tab", { name: "Find parking" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("tab", { name: "Share a spot" }).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Looking")).not.toBeInTheDocument();
    expect(screen.queryByText("Leaving")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My spot" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Log out" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Mobile" }),
    ).not.toBeInTheDocument();
  });

  it("applies safe-area top padding via the shell header class", () => {
    render(<AppNav />);
    expect(screen.getByTestId("app-nav").className).toContain("app-shell-header");
  });

  it("keeps the official logo on the shared full-width header inner", () => {
    const { rerender } = render(<AppNav compact />);
    const inner = screen.getByTestId("app-shell-header-inner");
    expect(inner.className).toBe("app-shell-header-inner");
    expect(inner.className).not.toContain("contained");
    expect(inner.className).not.toContain("wide");
    expect(inner.querySelector("img")).toHaveAttribute(
      "src",
      "/branding/switch-it-logo.png",
    );

    rerender(<AppNav />);
    expect(screen.getByTestId("app-shell-header-inner").className).toBe(
      "app-shell-header-inner",
    );
  });

  it("selects Find parking on /map and Share a spot on /spots/new", () => {
    const { rerender } = render(<AppNav />);
    expect(
      screen.getAllByRole("tab", { name: "Find parking" })[0],
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getAllByRole("tab", { name: "Share a spot" })[0],
    ).toHaveAttribute("aria-selected", "false");

    navigationState.pathname = "/spots/new";
    rerender(<AppNav />);
    expect(
      screen.getAllByRole("tab", { name: "Share a spot" })[0],
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getAllByRole("tab", { name: "Find parking" })[0],
    ).toHaveAttribute("aria-selected", "false");
  });

  it.each(["/profile", "/history", "/help", "/profile/vehicle"] as const)(
    "activates neither map tab on %s",
    (pathname) => {
      navigationState.pathname = pathname;
      modeState.mode = "leaver";
      render(<AppNav />);
      expect(
        screen.getAllByRole("tab", { name: "Find parking" })[0],
      ).toHaveAttribute("aria-selected", "false");
      expect(
        screen.getAllByRole("tab", { name: "Share a spot" })[0],
      ).toHaveAttribute("aria-selected", "false");
    },
  );

  it("opens a profile menu with Profile and Log out", async () => {
    const user = userEvent.setup();
    render(<AppNav displayName="Alex" />);

    await user.click(
      screen.getByRole("button", { name: "Profile menu for Alex" }),
    );
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(
      screen.getByRole("menuitem", { name: "Help & Safety" }),
    ).toHaveAttribute("href", "/help");
    expect(screen.getByRole("menuitem", { name: "History" })).toHaveAttribute(
      "href",
      "/history",
    );
    expect(
      screen.getByRole("menuitem", { name: "Log out" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("help-info-icon")).not.toBeInTheDocument();
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items.slice(0, 3)).toEqual(["Profile", "History", "Help & Safety"]);
  });
});
