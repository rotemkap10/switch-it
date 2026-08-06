import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/AppNav", () => ({
  AppNav: ({ compact }: { compact?: boolean }) => (
    <header data-testid="app-nav" data-compact={compact ? "true" : "false"}>
      Nav
    </header>
  ),
}));

vi.mock("@/components/mode/ModeGate", () => ({
  ModeGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/mode/ModeProvider", () => ({
  ModeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/navigation/CoreRoutePrefetch", () => ({
  CoreRoutePrefetch: () => null,
}));

vi.mock("@/components/map/MapLibreWarmup", () => ({
  MapLibreWarmup: () => null,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/map",
}));

import { AuthenticatedFrame } from "@/components/auth/AuthenticatedFrame";

describe("AuthenticatedFrame map layout", () => {
  it("fills the dynamic viewport with flex shell and no page scroll", () => {
    render(
      <AuthenticatedFrame
        userId="user-1"
        title="Find parking"
        description="Choose a spot nearby."
        layout="map"
      >
        <div data-testid="map-child" className="min-h-0 flex-1" />
      </AuthenticatedFrame>,
    );

    const shell = screen.getByTestId("authenticated-shell");
    expect(shell).toHaveAttribute("data-layout", "map");
    expect(shell.className).toContain("app-shell");
    expect(shell.className).toContain("app-shell--map");

    expect(screen.getByTestId("app-nav")).toHaveAttribute(
      "data-compact",
      "true",
    );

    const main = screen.getByTestId("authenticated-main");
    expect(main.className).toContain("app-shell-main");
    expect(main.className).toContain("app-shell-main--map");
    expect(main.className).not.toContain("app-bottom-nav");
    expect(main.className).not.toContain("app-shell-main--page");
    expect(screen.queryByRole("heading", { name: "Find parking" })).toBeNull();
    expect(document.querySelector(".motion-mode-content")).not.toBeNull();
  });

  it("keeps non-map routes scrollable with shared phone gutter classes", () => {
    render(
      <AuthenticatedFrame
        userId="user-1"
        title="Share a spot"
        description="Let nearby drivers know when you’re leaving."
        layout="default"
      >
        <div data-testid="page-child">Content</div>
      </AuthenticatedFrame>,
    );

    const shell = screen.getByTestId("authenticated-shell");
    expect(shell).toHaveAttribute("data-layout", "page");
    expect(shell.className).toContain("app-shell");
    expect(shell.className).not.toContain("app-shell--map");

    const main = screen.getByTestId("authenticated-main");
    expect(main.className).toContain("app-shell-main--page");
    expect(screen.getByRole("heading", { name: "Share a spot" })).toBeInTheDocument();
  });
});
