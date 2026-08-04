import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const modeState = vi.hoisted(() => ({
  mode: "seeker" as "seeker" | "leaver" | null,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/map",
}));

vi.mock("@/components/mode/ModeProvider", () => ({
  useMode: () => ({
    mode: modeState.mode,
    homeFor: (m: string) => (m === "leaver" ? "/spots/new" : "/map"),
    setMode: vi.fn(),
  }),
}));

vi.mock("@/components/auth/LogoutButton", () => ({
  LogoutButton: () => <button type="button">Log out</button>,
}));

vi.mock("@/components/mode/ModeSwitcher", () => ({
  ModeSwitcher: () => <div>Mode</div>,
}));

import { AppNav, linksByMode } from "@/components/layout/AppNav";

describe("AppNav mobile mode links", () => {
  beforeEach(() => {
    modeState.mode = "seeker";
  });

  it("exposes seeker Find parking and Profile links", () => {
    expect(linksByMode.seeker.map((l) => l.label)).toEqual([
      "Find parking",
      "Profile",
    ]);
    render(<AppNav compact />);
    expect(
      screen.getAllByRole("link", { name: "Find parking" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: "Profile" }).length,
    ).toBeGreaterThan(0);
  });

  it("exposes leaver My spot and Profile links", () => {
    modeState.mode = "leaver";
    expect(linksByMode.leaver.map((l) => l.label)).toEqual([
      "My spot",
      "Profile",
    ]);
    render(<AppNav compact />);
    expect(
      screen.getAllByRole("link", { name: "My spot" }).length,
    ).toBeGreaterThan(0);
  });

  it("renders a fixed mobile navigation landmark", () => {
    render(<AppNav compact />);
    const mobile = screen.getByRole("navigation", { name: "Mobile" });
    expect(mobile.className).toContain("fixed");
    expect(mobile.className).toContain("bottom-0");
  });
});
