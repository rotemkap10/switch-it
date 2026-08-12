"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Logo } from "@/components/branding/Logo";
import {
  AppLaunchReadyProvider,
  type AppLaunchPhase,
} from "@/components/shell/AppLaunchReadyContext";
import { IosStartupDebugProbe } from "@/components/shell/IosStartupDebugProbe";
import { isNativeHandoffPlatform } from "@/lib/location/is-native-handoff-platform";
import {
  afterNextPaint,
  markLaunchSplashSeen,
  prefersReducedMotionMedia,
  readLaunchSplashSeen,
  shouldSkipLaunchSplash,
  SPLASH_FADE_MS,
  SPLASH_MAX_MS,
} from "@/lib/motion/app-launch";
import { hideNativeSplashScreen } from "@/lib/native/splash-screen";
import { isStandaloneDisplayMode } from "@/lib/pwa/install-state";
import {
  BOOT_SPLASH_EXITING_CLASS,
  BOOT_SPLASH_HIDDEN_CLASS,
  BOOT_SPLASH_ID,
} from "@/lib/pwa/boot-splash";

type SplashPhase = "visible" | "exit" | "hidden";

type AppLaunchShellProps = {
  children: ReactNode;
};

function toLaunchPhase(phase: SplashPhase): AppLaunchPhase {
  if (phase === "visible") {
    return "covering";
  }
  if (phase === "exit") {
    return "releasing";
  }
  return "released";
}

function applyBootSplashPhase(phase: SplashPhase) {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  root.classList.toggle(BOOT_SPLASH_EXITING_CLASS, phase === "exit");
  root.classList.toggle(BOOT_SPLASH_HIDDEN_CLASS, phase === "hidden");
  if (phase === "hidden") {
    root.classList.remove(BOOT_SPLASH_EXITING_CLASS);
  }
}

/**
 * Single owner of cold-launch cover: COVERING → RELEASING → RELEASED.
 *
 * Hides the server-rendered boot splash only when the initial destination is
 * ready. Cold launch to /map waits for the first usable map frame — not shell
 * mount, hydration, or auth-routing placeholders.
 *
 * Invariant: while COVERING or RELEASING, car/map loaders stay suppressed and
 * the logo + #dff4ff background remain together.
 */
export function AppLaunchShell({ children }: AppLaunchShellProps) {
  const [phase, setPhase] = useState<SplashPhase>("visible");
  const [ownsSplash] = useState(() => {
    if (typeof document === "undefined") {
      return false;
    }
    return !document.getElementById(BOOT_SPLASH_ID);
  });
  const [shellReady, setShellReady] = useState(false);
  const [awaitInitialMap, setAwaitInitialMap] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const coldLaunchRef = useRef(false);
  const exitStartedRef = useRef(false);
  const awaitInitialMapRef = useRef(false);
  const mapReadyRef = useRef(false);

  const reportInitialShellReady = useCallback(() => {
    setShellReady(true);
  }, []);

  const requestAwaitInitialMap = useCallback(() => {
    if (exitStartedRef.current) {
      return;
    }
    awaitInitialMapRef.current = true;
    setAwaitInitialMap(true);
  }, []);

  const reportInitialMapReady = useCallback(() => {
    mapReadyRef.current = true;
    setMapReady(true);
  }, []);

  const beginExit = useCallback((options?: { force?: boolean }) => {
    if (exitStartedRef.current) {
      return;
    }
    // Never release into a map destination without a map frame once await
    // was requested — unless the safety timeout forces release.
    if (
      !options?.force &&
      awaitInitialMapRef.current &&
      !mapReadyRef.current
    ) {
      return;
    }
    exitStartedRef.current = true;
    // Reveal the identical HTML boot splash under the native overlay, then fade.
    // Logo + background stay together until opacity hits 0 as one unit.
    void hideNativeSplashScreen();
    if (prefersReducedMotionMedia()) {
      setPhase("hidden");
      return;
    }
    setPhase("exit");
  }, []);

  useLayoutEffect(() => {
    applyBootSplashPhase(phase);
  }, [phase]);

  useEffect(() => {
    awaitInitialMapRef.current = awaitInitialMap;
  }, [awaitInitialMap]);

  useEffect(() => {
    mapReadyRef.current = mapReady;
  }, [mapReady]);

  useEffect(() => {
    const skip = shouldSkipLaunchSplash({
      reducedMotion: prefersReducedMotionMedia(),
      alreadySeen: readLaunchSplashSeen(),
      standalone: isStandaloneDisplayMode(),
      nativeCapacitor: isNativeHandoffPlatform(),
    });

    if (skip) {
      coldLaunchRef.current = false;
      exitStartedRef.current = true;
      void hideNativeSplashScreen();
      const id = window.setTimeout(() => setPhase("hidden"), 0);
      return () => window.clearTimeout(id);
    }

    coldLaunchRef.current = true;
    markLaunchSplashSeen();
    const maxTimer = window.setTimeout(() => {
      beginExit({ force: true });
    }, SPLASH_MAX_MS);
    return () => window.clearTimeout(maxTimer);
  }, [beginExit]);

  const launchExitReady = shellReady && (!awaitInitialMap || mapReady);

  useEffect(() => {
    if (!coldLaunchRef.current || phase !== "visible" || !launchExitReady) {
      return;
    }
    return afterNextPaint(() => beginExit());
  }, [launchExitReady, phase, beginExit]);

  useEffect(() => {
    if (phase !== "exit") {
      return;
    }

    const timer = window.setTimeout(() => setPhase("hidden"), SPLASH_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const showOwnedSplash =
    ownsSplash && (phase === "visible" || phase === "exit");
  const launchPhase = toLaunchPhase(phase);

  return (
    <AppLaunchReadyProvider
      phase={launchPhase}
      reportInitialShellReady={reportInitialShellReady}
      requestAwaitInitialMap={requestAwaitInitialMap}
      reportInitialMapReady={reportInitialMapReady}
    >
      {process.env.NODE_ENV !== "production" ? <IosStartupDebugProbe /> : null}
      {showOwnedSplash ? (
        <div
          className={[
            "app-launch-splash",
            phase === "exit" ? "is-exiting" : "",
          ].join(" ")}
          role="status"
          aria-live="polite"
          aria-label="Loading Switch It"
          data-testid="app-launch-splash"
          data-splash-phase={phase}
          data-launch-phase={launchPhase}
        >
          <div className="app-launch-splash__logo">
            <Logo variant="splash" decorative />
          </div>
        </div>
      ) : null}
      <div
        className="app-content-shell"
        data-testid="app-content-shell"
        data-launch-phase={launchPhase}
      >
        {children}
      </div>
    </AppLaunchReadyProvider>
  );
}
