import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InitialShellReadyMarker } from "@/components/shell/InitialShellReadyMarker";
import { AppLaunchShell } from "@/components/shell/AppLaunchShell";
import {
  APP_LAUNCH_SPLASH_SEEN_KEY,
  SPLASH_FADE_MS,
  SPLASH_MAX_MS,
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

function ReadyChild() {
  return (
    <>
      <InitialShellReadyMarker />
      <p>App content</p>
    </>
  );
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
    expect(screen.getByTestId("app-launch-splash")).toHaveAttribute(
      "aria-label",
      "Loading Switch It",
    );
    expect(
      screen.getByTestId("app-launch-splash").querySelector("img"),
    ).toHaveAttribute("src", "/branding/switch-it-logo.png");
    expect(
      screen.getByTestId("app-launch-splash").querySelector(".motion-launch-logo"),
    ).toBeNull();
  });

  it("does not disappear solely because the document has loaded", () => {
    render(
      <AppLaunchShell>
        <p>App content</p>
      </AppLaunchShell>,
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByTestId("app-launch-splash")).toBeInTheDocument();
    expect(screen.getByTestId("app-content-shell")).toHaveClass("is-waiting");
  });

  it("keeps splash until the initial shell reports ready", () => {
    render(
      <AppLaunchShell>
        <ReadyChild />
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

  it("still shows splash under reduced motion until the shell is ready", () => {
    mockMatchMedia(true);

    render(
      <AppLaunchShell>
        <p>App content</p>
      </AppLaunchShell>,
    );

    expect(screen.getByTestId("app-launch-splash")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId("app-launch-splash")).toBeInTheDocument();
  });

  it("hides instantly under reduced motion once the shell is ready", () => {
    mockMatchMedia(true);

    render(
      <AppLaunchShell>
        <ReadyChild />
      </AppLaunchShell>,
    );

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
    expect(screen.getByTestId("app-content-shell")).toHaveClass("is-ready");
  });

  it("exits via safety max if the shell never reports ready", () => {
    render(
      <AppLaunchShell>
        <p>Stuck loading</p>
      </AppLaunchShell>,
    );

    act(() => {
      vi.advanceTimersByTime(SPLASH_MAX_MS + 10);
    });
    act(() => {
      vi.advanceTimersByTime(SPLASH_FADE_MS + 50);
    });

    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
    expect(screen.getByTestId("app-content-shell")).toHaveClass("is-ready");
  });

  it("does not replay splash on remount after session mark", () => {
    const { unmount } = render(
      <AppLaunchShell>
        <ReadyChild />
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
