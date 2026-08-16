import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";

import { InitialShellReadyMarker } from "@/components/shell/InitialShellReadyMarker";
import { AppLaunchShell } from "@/components/shell/AppLaunchShell";
import {
  useReportInitialMapReady,
  useReportInitialShellReady,
  useRequestAwaitInitialMap,
  useAppLaunchReady,
} from "@/components/shell/AppLaunchReadyContext";
import { BOOT_SPLASH_HIDDEN_CLASS, BOOT_SPLASH_ID } from "@/lib/pwa/boot-splash";
import {
  APP_LAUNCH_SPLASH_SEEN_KEY,
  SPLASH_FADE_MS,
  SPLASH_MAX_MS,
} from "@/lib/motion/app-launch";

const hideNativeSplashMock = vi.fn().mockResolvedValue(undefined);
const waitForBootSplashPaintMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/native/splash-screen", () => ({
  hideNativeSplashScreen: (...args: unknown[]) => hideNativeSplashMock(...args),
}));

vi.mock("@/lib/native/wait-for-boot-splash-paint", () => ({
  waitForWebBootSplashPainted: (...args: unknown[]) =>
    waitForBootSplashPaintMock(...args),
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

async function flushSplashUntilHidden() {
  await act(async () => {
    vi.runOnlyPendingTimers();
    vi.runOnlyPendingTimers();
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => {
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

function AuthRoutingThenMapChild({
  mapReady = false,
}: {
  mapReady?: boolean;
}) {
  const requestAwait = useRequestAwaitInitialMap();
  const reportMap = useReportInitialMapReady();
  const reportShell = useReportInitialShellReady();

  // Simulate the fixed home-page behavior: auth routing does NOT report shell
  // ready. Only after /map mounts do we await map + report shell.
  useEffect(() => {
    const id = window.setTimeout(() => {
      requestAwait();
      reportShell();
      if (mapReady) {
        reportMap();
      }
    }, 80);
    return () => window.clearTimeout(id);
  }, [requestAwait, reportShell, reportMap, mapReady]);

  return <p>Auth routing then map</p>;
}

function SignedInMapColdLaunch({ mapReady = false }: { mapReady?: boolean }) {
  const requestAwait = useRequestAwaitInitialMap();
  const reportMap = useReportInitialMapReady();
  const reportShell = useReportInitialShellReady();
  const launchReady = useAppLaunchReady();

  useEffect(() => {
    // Correct /map ModeGate ordering: await map BEFORE/with shell ready.
    requestAwait();
    reportShell();
  }, [requestAwait, reportShell]);

  useEffect(() => {
    if (mapReady) {
      reportMap();
    }
  }, [mapReady, reportMap]);

  return (
    <>
      <p>Map shell</p>
      {launchReady ? (
        <div data-testid="post-launch-car-loader">car loader after release</div>
      ) : (
        <div data-testid="map-loading-suppressed-by-launch" />
      )}
    </>
  );
}

function PrematureShellReadyBug({ mapReady = false }: { mapReady?: boolean }) {
  const requestAwait = useRequestAwaitInitialMap();
  const reportMap = useReportInitialMapReady();
  const reportShell = useReportInitialShellReady();

  // OLD buggy `/` checking behavior — must not be used in production.
  useEffect(() => {
    reportShell();
  }, [reportShell]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      requestAwait();
      if (mapReady) {
        reportMap();
      }
    }, 200);
    return () => window.clearTimeout(id);
  }, [requestAwait, reportMap, mapReady]);

  return <p>Premature shell</p>;
}

describe("AppLaunchShell", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    sessionStorage.clear();
    hideNativeSplashMock.mockClear();
    waitForBootSplashPaintMock.mockClear();
    waitForBootSplashPaintMock.mockResolvedValue(undefined);
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

  it("keeps splash until the initial shell reports ready", async () => {
    render(
      <AppLaunchShell>
        <ReadyChild />
      </AppLaunchShell>,
    );

    expect(screen.getByTestId("app-launch-splash")).toBeInTheDocument();

    await flushSplashUntilHidden();

    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
    expect(screen.getByText("App content")).toBeInTheDocument();
    expect(sessionStorage.getItem(APP_LAUNCH_SPLASH_SEEN_KEY)).toBe("1");
    expect(hideNativeSplashMock).toHaveBeenCalled();
  });

  it("keeps splash while awaiting initial map even after shell ready", () => {
    render(
      <AppLaunchShell>
        <SignedInMapColdLaunch mapReady={false} />
      </AppLaunchShell>,
    );

    // Flush child effects / paint frames without running SPLASH_MAX_MS.
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByTestId("app-launch-splash")).toBeInTheDocument();
    expect(hideNativeSplashMock).not.toHaveBeenCalled();
  });

  it("hides splash into the map once initial map reports ready", async () => {
    const { rerender } = render(
      <AppLaunchShell>
        <SignedInMapColdLaunch mapReady={false} />
      </AppLaunchShell>,
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByTestId("app-launch-splash")).toBeInTheDocument();

    rerender(
      <AppLaunchShell>
        <SignedInMapColdLaunch mapReady />
      </AppLaunchShell>,
    );

    await flushSplashUntilHidden();

    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
    expect(hideNativeSplashMock).toHaveBeenCalled();
  });

  it("signed-in cold launch: shell+map mount without visual ready keeps logo and suppresses car", () => {
    const boot = document.createElement("div");
    boot.id = BOOT_SPLASH_ID;
    boot.innerHTML = "<img alt='' src='/branding/switch-it-logo.png' />";
    document.body.append(boot);

    render(
      <AppLaunchShell>
        <SignedInMapColdLaunch mapReady={false} />
      </AppLaunchShell>,
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(document.documentElement.classList.contains(BOOT_SPLASH_HIDDEN_CLASS)).toBe(
      false,
    );
    expect(boot.querySelector("img")).toBeTruthy();
    expect(
      screen.getByTestId("map-loading-suppressed-by-launch"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("post-launch-car-loader")).not.toBeInTheDocument();
    expect(hideNativeSplashMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("app-content-shell")).toHaveAttribute(
      "data-launch-phase",
      "covering",
    );

    boot.remove();
  });

  it("signed-in cold launch: map visually ready releases splash with no car flash", async () => {
    const { rerender } = render(
      <AppLaunchShell>
        <SignedInMapColdLaunch mapReady={false} />
      </AppLaunchShell>,
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(
      screen.getByTestId("map-loading-suppressed-by-launch"),
    ).toBeInTheDocument();

    rerender(
      <AppLaunchShell>
        <SignedInMapColdLaunch mapReady />
      </AppLaunchShell>,
    );
    await flushSplashUntilHidden();

    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
    expect(screen.getByTestId("app-content-shell")).toHaveAttribute(
      "data-launch-phase",
      "released",
    );
    expect(screen.getByTestId("post-launch-car-loader")).toBeInTheDocument();
  });

  it("auth-routing delay then map await keeps splash until map ready", () => {
    render(
      <AppLaunchShell>
        <AuthRoutingThenMapChild mapReady={false} />
      </AppLaunchShell>,
    );

    act(() => {
      vi.advanceTimersByTime(40);
    });
    expect(screen.getByTestId("app-launch-splash")).toBeInTheDocument();
    expect(hideNativeSplashMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByTestId("app-launch-splash")).toBeInTheDocument();
    expect(hideNativeSplashMock).not.toHaveBeenCalled();
  });

  it("documents that premature shell-ready without await-map releases splash (home must not do this)", async () => {
    render(
      <AppLaunchShell>
        <PrematureShellReadyBug mapReady={false} />
      </AppLaunchShell>,
    );

    await flushSplashUntilHidden();

    // This is why home auth-checking must not call InitialShellReadyMarker.
    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
    expect(hideNativeSplashMock).toHaveBeenCalled();
  });

  it("skips splash when already seen this session", async () => {
    sessionStorage.setItem(APP_LAUNCH_SPLASH_SEEN_KEY, "1");

    render(
      <AppLaunchShell>
        <p>App content</p>
      </AppLaunchShell>,
    );

    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
    expect(hideNativeSplashMock).toHaveBeenCalled();
    expect(waitForBootSplashPaintMock).toHaveBeenCalled();
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

  it("hides instantly under reduced motion once the shell is ready", async () => {
    mockMatchMedia({ reducedMotion: true });

    render(
      <AppLaunchShell>
        <ReadyChild />
      </AppLaunchShell>,
    );

    await act(async () => {
      vi.runOnlyPendingTimers();
      vi.runOnlyPendingTimers();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
    expect(hideNativeSplashMock).toHaveBeenCalled();
  });

  it("exits via safety max if the shell never reports ready", async () => {
    render(
      <AppLaunchShell>
        <p>Stuck loading</p>
      </AppLaunchShell>,
    );

    await act(async () => {
      vi.advanceTimersByTime(SPLASH_MAX_MS + 10);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(SPLASH_FADE_MS + 50);
    });

    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
    expect(hideNativeSplashMock).toHaveBeenCalled();
  });

  it("exits via safety max if the map never becomes ready", async () => {
    render(
      <AppLaunchShell>
        <SignedInMapColdLaunch mapReady={false} />
      </AppLaunchShell>,
    );

    await act(async () => {
      vi.advanceTimersByTime(SPLASH_MAX_MS + 10);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(SPLASH_FADE_MS + 50);
    });

    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
    expect(hideNativeSplashMock).toHaveBeenCalled();
  });

  it("hides a server-rendered boot splash instead of mounting a second one", async () => {
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

    await flushSplashUntilHidden();

    expect(document.documentElement.classList.contains(BOOT_SPLASH_HIDDEN_CLASS)).toBe(
      true,
    );
    boot.remove();
    document.documentElement.classList.remove(BOOT_SPLASH_HIDDEN_CLASS);
  });

  it("does not replay splash on remount after session mark", async () => {
    const { unmount } = render(
      <AppLaunchShell>
        <ReadyChild />
      </AppLaunchShell>,
    );

    await flushSplashUntilHidden();
    unmount();

    render(
      <AppLaunchShell>
        <p>Second</p>
      </AppLaunchShell>,
    );

    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
      await Promise.resolve();
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
