import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppLaunchShell } from "@/components/shell/AppLaunchShell";
import {
  APP_LAUNCH_SPLASH_SEEN_KEY,
  SPLASH_FADE_MS,
} from "@/lib/motion/app-launch";

function mockMatchMedia(reducedMotion: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reducedMotion && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
}

describe("AppLaunchShell", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    sessionStorage.clear();
    Object.defineProperty(document, "readyState", {
      configurable: true,
      value: "complete",
    });
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("shows branded splash on first session launch", () => {
    render(
      <AppLaunchShell>
        <p>App content</p>
      </AppLaunchShell>,
    );

    expect(screen.getByTestId("app-launch-splash")).toBeInTheDocument();
    expect(screen.getByText("Switch It")).toBeInTheDocument();
    expect(
      screen.getByTestId("app-launch-splash").querySelector(".switch-it-logo-mark"),
    ).not.toBeNull();
    expect(
      screen.getByTestId("app-launch-splash").querySelector(".motion-launch-logo"),
    ).toBeNull();
  });

  it("skips splash when already seen this session", () => {
    sessionStorage.setItem(APP_LAUNCH_SPLASH_SEEN_KEY, "1");

    render(
      <AppLaunchShell>
        <p>App content</p>
      </AppLaunchShell>,
    );

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByTestId("app-content-shell")).toHaveClass("is-ready");
    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
  });

  it("skips splash when reduced motion is preferred", () => {
    mockMatchMedia(true);

    render(
      <AppLaunchShell>
        <p>App content</p>
      </AppLaunchShell>,
    );

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByTestId("app-content-shell")).toHaveClass("is-ready");
    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
    expect(sessionStorage.getItem(APP_LAUNCH_SPLASH_SEEN_KEY)).toBeNull();
  });

  it("reveals app content after splash exit without artificial minimum", () => {
    render(
      <AppLaunchShell>
        <p>App content</p>
      </AppLaunchShell>,
    );

    expect(screen.getByTestId("app-launch-splash")).toBeInTheDocument();

    act(() => {
      vi.runOnlyPendingTimers();
    });

    act(() => {
      vi.advanceTimersByTime(SPLASH_FADE_MS + 50);
    });

    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
    expect(screen.getByTestId("app-content-shell")).toHaveClass("is-ready");
    expect(screen.getByText("App content")).toBeInTheDocument();
    expect(sessionStorage.getItem(APP_LAUNCH_SPLASH_SEEN_KEY)).toBe("1");
  });

  it("does not replay splash on remount after session mark", () => {
    const { unmount } = render(
      <AppLaunchShell>
        <p>First</p>
      </AppLaunchShell>,
    );

    act(() => {
      vi.runOnlyPendingTimers();
    });
    act(() => {
      vi.advanceTimersByTime(SPLASH_FADE_MS + 50);
    });
    unmount();

    render(
      <AppLaunchShell>
        <p>Second</p>
      </AppLaunchShell>,
    );

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });
});
