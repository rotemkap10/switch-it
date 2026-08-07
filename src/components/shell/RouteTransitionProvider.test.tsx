import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigationState = vi.hoisted(() => ({
  pathname: "/map",
  search: "",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useSearchParams: () => new URLSearchParams(navigationState.search),
}));

vi.mock("@/components/shell/AppLaunchReadyContext", () => ({
  useAppLaunchReady: () => true,
}));

import { RouteTransitionProvider } from "@/components/shell/RouteTransitionProvider";
import {
  ROUTE_TRANSITION_MIN_VISIBLE_MS,
  ROUTE_TRANSITION_REVEAL_DELAY_MS,
} from "@/lib/motion/route-transition";

function clickLink(name: string, init?: MouseEventInit) {
  const link = screen.getByRole("link", { name });
  link.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  );
}

describe("RouteTransitionProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    navigationState.pathname = "/map";
    navigationState.search = "";
    window.history.replaceState({}, "", "/map");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not flash the overlay when navigation completes before reveal", () => {
    const { rerender } = render(
      <RouteTransitionProvider>
        <a href="/profile" onClick={(e) => e.preventDefault()}>
          Profile
        </a>
      </RouteTransitionProvider>,
    );

    act(() => {
      clickLink("Profile");
    });

    expect(
      screen.queryByTestId("route-transition-overlay"),
    ).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(ROUTE_TRANSITION_REVEAL_DELAY_MS - 1);
    });
    expect(
      screen.queryByTestId("route-transition-overlay"),
    ).not.toBeInTheDocument();

    navigationState.pathname = "/profile";
    window.history.replaceState({}, "", "/profile");
    rerender(
      <RouteTransitionProvider>
        <p>Profile page</p>
      </RouteTransitionProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(ROUTE_TRANSITION_REVEAL_DELAY_MS + 50);
    });
    expect(
      screen.queryByTestId("route-transition-overlay"),
    ).not.toBeInTheDocument();
  });

  it("reveals the branded overlay after the delay and clears on destination", () => {
    const { rerender } = render(
      <RouteTransitionProvider>
        <a href="/profile" onClick={(e) => e.preventDefault()}>
          Profile
        </a>
      </RouteTransitionProvider>,
    );

    act(() => {
      clickLink("Profile");
      vi.advanceTimersByTime(ROUTE_TRANSITION_REVEAL_DELAY_MS);
    });

    expect(screen.getByTestId("route-transition-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("branded-loading-pin")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading page")).toBeInTheDocument();

    navigationState.pathname = "/profile";
    window.history.replaceState({}, "", "/profile");
    rerender(
      <RouteTransitionProvider>
        <p>Profile page</p>
      </RouteTransitionProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(ROUTE_TRANSITION_MIN_VISIBLE_MS);
    });

    expect(
      screen.queryByTestId("route-transition-overlay"),
    ).not.toBeInTheDocument();
  });

  it("keeps the overlay for the minimum visible duration", () => {
    const { rerender } = render(
      <RouteTransitionProvider>
        <a href="/history" onClick={(e) => e.preventDefault()}>
          History
        </a>
      </RouteTransitionProvider>,
    );

    act(() => {
      clickLink("History");
      vi.advanceTimersByTime(ROUTE_TRANSITION_REVEAL_DELAY_MS);
    });

    expect(screen.getByTestId("route-transition-overlay")).toBeInTheDocument();

    navigationState.pathname = "/history";
    window.history.replaceState({}, "", "/history");
    rerender(
      <RouteTransitionProvider>
        <p>History page</p>
      </RouteTransitionProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(ROUTE_TRANSITION_MIN_VISIBLE_MS - 50);
    });
    expect(screen.getByTestId("route-transition-overlay")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(
      screen.queryByTestId("route-transition-overlay"),
    ).not.toBeInTheDocument();
  });

  it("ignores external, new-tab, and modified clicks", () => {
    render(
      <RouteTransitionProvider>
        <a href="https://example.com" onClick={(e) => e.preventDefault()}>
          External
        </a>
        <a
          href="/profile"
          target="_blank"
          onClick={(e) => e.preventDefault()}
        >
          New tab
        </a>
        <a href="/profile" onClick={(e) => e.preventDefault()}>
          Profile
        </a>
        <a href="#section" onClick={(e) => e.preventDefault()}>
          Hash
        </a>
      </RouteTransitionProvider>,
    );

    act(() => {
      clickLink("External");
      clickLink("New tab");
      clickLink("Profile", { ctrlKey: true });
      clickLink("Hash");
      vi.advanceTimersByTime(ROUTE_TRANSITION_REVEAL_DELAY_MS + 20);
    });

    expect(
      screen.queryByTestId("route-transition-overlay"),
    ).not.toBeInTheDocument();
  });

  it("clears after browser history navigation once React location matches", () => {
    render(
      <RouteTransitionProvider>
        <p>Map</p>
      </RouteTransitionProvider>,
    );

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    // Address bar already matches React location → cancel before reveal (no flash).
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(
      screen.queryByTestId("route-transition-overlay"),
    ).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(ROUTE_TRANSITION_REVEAL_DELAY_MS + 20);
    });

    expect(
      screen.queryByTestId("route-transition-overlay"),
    ).not.toBeInTheDocument();
  });

  it("shows then clears history navigation when React catches up after a path change", () => {
    const { rerender } = render(
      <RouteTransitionProvider>
        <p>Map</p>
      </RouteTransitionProvider>,
    );

    // Simulate back navigation where the window URL moved first.
    window.history.replaceState({}, "", "/profile");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
      vi.advanceTimersByTime(ROUTE_TRANSITION_REVEAL_DELAY_MS);
    });

    expect(screen.getByTestId("route-transition-overlay")).toBeInTheDocument();

    navigationState.pathname = "/profile";
    rerender(
      <RouteTransitionProvider>
        <p>Profile</p>
      </RouteTransitionProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(ROUTE_TRANSITION_MIN_VISIBLE_MS);
    });

    expect(
      screen.queryByTestId("route-transition-overlay"),
    ).not.toBeInTheDocument();
  });

  it("does not start for the already-active route", () => {
    render(
      <RouteTransitionProvider>
        <a href="/map" onClick={(e) => e.preventDefault()}>
          Find parking
        </a>
      </RouteTransitionProvider>,
    );

    act(() => {
      clickLink("Find parking");
      vi.advanceTimersByTime(ROUTE_TRANSITION_REVEAL_DELAY_MS + 20);
    });

    expect(
      screen.queryByTestId("route-transition-overlay"),
    ).not.toBeInTheDocument();
  });

  it("clears pending state on unmount", () => {
    const { unmount } = render(
      <RouteTransitionProvider>
        <a href="/profile" onClick={(e) => e.preventDefault()}>
          Profile
        </a>
      </RouteTransitionProvider>,
    );

    act(() => {
      clickLink("Profile");
      vi.advanceTimersByTime(ROUTE_TRANSITION_REVEAL_DELAY_MS);
    });
    expect(screen.getByTestId("route-transition-overlay")).toBeInTheDocument();

    unmount();
    expect(
      screen.queryByTestId("route-transition-overlay"),
    ).not.toBeInTheDocument();
  });
});
