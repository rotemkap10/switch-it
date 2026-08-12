import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/shell/AppLaunchReadyContext", () => ({
  useAppLaunchReady: () => false,
  useReportInitialShellReady: () => () => {},
  useRequestAwaitInitialMap: () => () => {},
  useReportInitialMapReady: () => () => {},
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/map",
  useSearchParams: () => new URLSearchParams(),
}));

import { RouteTransitionProvider } from "@/components/shell/RouteTransitionProvider";
import { ROUTE_TRANSITION_REVEAL_DELAY_MS } from "@/lib/motion/route-transition";
import { act } from "@testing-library/react";

describe("RouteTransitionProvider launch splash gate", () => {
  it("does not show the route overlay while launch splash is active", () => {
    vi.useFakeTimers();
    render(
      <RouteTransitionProvider>
        <a href="/profile">Profile</a>
      </RouteTransitionProvider>,
    );

    act(() => {
      screen.getByRole("link", { name: "Profile" }).dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      vi.advanceTimersByTime(ROUTE_TRANSITION_REVEAL_DELAY_MS + 50);
    });

    expect(
      screen.queryByTestId("route-transition-overlay"),
    ).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
