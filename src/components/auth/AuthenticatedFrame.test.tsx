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

vi.mock("next/navigation", () => ({
  usePathname: () => "/map",
}));

import { AuthenticatedFrame } from "@/components/auth/AuthenticatedFrame";

describe("AuthenticatedFrame map layout", () => {
  it("fills the dynamic viewport without bottom-nav padding", () => {
    const { container } = render(
      <AuthenticatedFrame
        userId="user-1"
        title="Find parking"
        description="Choose a spot nearby."
        layout="map"
      >
        <div data-testid="map-child" className="min-h-0 flex-1" />
      </AuthenticatedFrame>,
    );

    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain("h-dvh");
    expect(shell.className).toContain("max-h-dvh");
    expect(shell.className).toContain("overflow-hidden");
    expect(shell.className).toContain("flex-col");

    expect(screen.getByTestId("app-nav")).toHaveAttribute(
      "data-compact",
      "true",
    );

    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    expect(main?.className).toContain("flex-1");
    expect(main?.className).toContain("min-h-0");
    expect(main?.className).toContain("max-w-none");
    expect(main?.className).not.toContain("app-bottom-nav");
    expect(main?.className).not.toContain("max-w-5xl");
    expect(main?.className).not.toContain("py-8");
    expect(container.querySelector(".motion-mode-content")).not.toBeNull();
  });
});
