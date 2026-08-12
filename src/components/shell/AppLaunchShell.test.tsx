import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";

import { InitialShellReadyMarker } from "@/components/shell/InitialShellReadyMarker";
import { AppLaunchShell } from "@/components/shell/AppLaunchShell";
import {
  useReportInitialMapReady,
  useRequestAwaitInitialMap,
} from "@/components/shell/AppLaunchReadyContext";
import { BOOT_SPLASH_HIDDEN_CLASS, BOOT_SPLASH_ID } from "@/lib/pwa/boot-splash";
import {
  APP_LAUNCH_SPLASH_SEEN_KEY,
  SPLASH_FADE_MS,
  SPLASH_MAX_MS,
} from "@/lib/motion/app-launch";

const hideNativeSplashMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/native/splash-screen", () => ({
  hideNativeSplashScreen: (...args: unknown[]) => hideNativeSplashMock(...args),
}));

vi.mock("@/lib/location/is-native-handoff-platform", () => ({
  isNativeHandoffPlatform: vi.fn(() => false),
}));

function mockMatchMedia(options: {
  reducedMotion?: boolean;
  standalone?: boolean;
} = {}) {
  const reducedMotion = options.reducedMotion ?? false;
  const standalone = options.standalone ?? false;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches:
      (reducedMotion && query.includes("prefers-reduced-motion")) ||
      (standalone && query.includes("display-mode: standalone")),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
}

function flushSplashUntilHidden() {
  act(() => {
    vi.runOnlyPendingTimers();
    vi.runOnlyPendingTimers();
  });
  act(() => {
    vi.advanceTimersByTime(SPLASH_FADE_MS + 50);
  });
}

function ReadyChild() {
  return (
    <>
      <InitialShellReadyMarker />
      <p>App content</p>
    </>
  );
}

function MapColdLaunchChild({
  mapReady = false,
}: {
  mapReady?: boolean;
}) {
  const requestAwait = useRequestAwaitInitialMap();
  const reportMap = useReportInitialMapReady();

  useEffect(() => {
    requestAwait();
  }, [requestAwait]);

  useEffect(() => {
    if (mapReady) {
      reportMap();
    }
  }, [mapReady, reportMap]);

  return (
    <>
      <InitialShellReadyMarker />
      <p>Map shell</p>
    </>
  );
}

describe("AppLaunchShell", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    sessionStorage.clear();
    hideNativeSplashMock.mockClear();
    Object.defineProperty(document, "readyState", {
      configurable: true,
      value: "complete",
    });
    mockMatchMedia();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      return window.setTimeout(() => cb(0), 0) as unknown as number;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      window.clearTimeout(id);
    });
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
    expect(screen.getByTestId("app-content-shell")).toBeInTheDocument();
  });

  it("keeps splash until the initial shell reports ready", () => {
    render(
      <AppLaunchShell>
        <ReadyChild />
      </AppLaunchShell>,
    );

    expect(screen.getByTestId("app-launch-splash")).toBeInTheDocument();

    flushSplashUntilHidden();

    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
    expect(screen.getByText("App content")).toBeInTheDocument();
    expect(sessionStorage.getItem(APP_LAUNCH_SPLASH_SEEN_KEY)).toBe("1");
    expect(hideNativeSplashMock).toHaveBeenCalled();
  });

  it("keeps splash while awaiting initial map even after shell ready", () => {
    render(
      <AppLaunchShell>
        <MapColdLaunchChild mapReady={false} />
      </AppLaunchShell>,
    );

    // Flush child effects / paint frames without running SPLASH_MAX_MS.
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByTestId("app-launch-splash")).toBeInTheDocument();
    expect(hideNativeSplashMock).not.toHaveBeenCalled();
  });

  it("hides splash into the map once initial map reports ready", () => {
    const { rerender } = render(
      <AppLaunchShell>
        <MapColdLaunchChild mapReady={false} />
      </AppLaunchShell>,
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByTestId("app-launch-splash")).toBeInTheDocument();

    rerender(
      <AppLaunchShell>
        <MapColdLaunchChild mapReady />
      </AppLaunchShell>,
    );

    flushSplashUntilHidden();

    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
    expect(hideNativeSplashMock).toHaveBeenCalled();
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

    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
    expect(hideNativeSplashMock).toHaveBeenCalled();
  });

  it("still shows splash under reduced motion until the shell is ready", () => {
    mockMatchMedia({ reducedMotion: true });

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
    mockMatchMedia({ reducedMotion: true });

    render(
      <AppLaunchShell>
        <ReadyChild />
      </AppLaunchShell>,
    );

    act(() => {
      vi.runOnlyPendingTimers();
      vi.runOnlyPendingTimers();
    });

    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
    expect(hideNativeSplashMock).toHaveBeenCalled();
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
    expect(hideNativeSplashMock).toHaveBeenCalled();
  });

  it("exits via safety max if the map never becomes ready", () => {
    render(
      <AppLaunchShell>
        <MapColdLaunchChild mapReady={false} />
      </AppLaunchShell>,
    );

    act(() => {
      vi.advanceTimersByTime(SPLASH_MAX_MS + 10);
    });
    act(() => {
      vi.advanceTimersByTime(SPLASH_FADE_MS + 50);
    });

    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
    expect(hideNativeSplashMock).toHaveBeenCalled();
  });

  it("hides a server-rendered boot splash instead of mounting a second one", () => {
    const boot = document.createElement("div");
    boot.id = BOOT_SPLASH_ID;
    boot.setAttribute("data-testid", "app-launch-splash");
    document.body.append(boot);

    render(
      <AppLaunchShell>
        <ReadyChild />
      </AppLaunchShell>,
    );

    expect(document.querySelectorAll("#app-boot-splash")).toHaveLength(1);

    flushSplashUntilHidden();

    expect(document.documentElement.classList.contains(BOOT_SPLASH_HIDDEN_CLASS)).toBe(
      true,
    );
    boot.remove();
    document.documentElement.classList.remove(BOOT_SPLASH_HIDDEN_CLASS);
  });

  it("does not replay splash on remount after session mark", () => {
    const { unmount } = render(
      <AppLaunchShell>
        <ReadyChild />
      </AppLaunchShell>,
    );

    flushSplashUntilHidden();
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

  it("still shows splash on standalone PWA launch even if sessionStorage is marked", () => {
    sessionStorage.setItem(APP_LAUNCH_SPLASH_SEEN_KEY, "1");
    mockMatchMedia({ standalone: true });

    render(
      <AppLaunchShell>
        <p>App content</p>
      </AppLaunchShell>,
    );

    expect(screen.getByTestId("app-launch-splash")).toBeInTheDocument();
  });
});
