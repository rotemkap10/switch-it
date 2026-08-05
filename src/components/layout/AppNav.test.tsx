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

  it("shows one mode switch with Find parking and Share a spot", () => {
    render(<AppNav displayName="Alex" />);

    const switches = screen.getAllByTestId("mode-switch");
    expect(switches.length).toBeGreaterThanOrEqual(1);
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

  it("selects Find parking on /map and Share a spot on /spots/new", () => {
    const { rerender } = render(<AppNav />);
    expect(
      screen.getAllByRole("tab", { name: "Find parking" })[0],
    ).toHaveAttribute("aria-selected", "true");

    navigationState.pathname = "/spots/new";
    rerender(<AppNav />);
    expect(
      screen.getAllByRole("tab", { name: "Share a spot" })[0],
    ).toHaveAttribute("aria-selected", "true");
  });

  it("opens a profile menu with Profile and Log out", async () => {
    const user = userEvent.setup();
    render(<AppNav displayName="Alex" />);

    await user.click(screen.getByRole("button", { name: "Profile menu" }));
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(
      screen.getByRole("menuitem", { name: "Log out" }),
    ).toBeInTheDocument();
  });
});
