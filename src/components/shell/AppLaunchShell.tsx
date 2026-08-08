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
import { AppLaunchReadyProvider } from "@/components/shell/AppLaunchReadyContext";
import { IosStartupDebugProbe } from "@/components/shell/IosStartupDebugProbe";
import {
  afterNextPaint,
  markLaunchSplashSeen,
  prefersReducedMotionMedia,
  readLaunchSplashSeen,
  shouldSkipLaunchSplash,
  SPLASH_FADE_MS,
  SPLASH_MAX_MS,
} from "@/lib/motion/app-launch";
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
 * Hides the server-rendered boot splash when the initial application shell
 * reports ready. Does not wait to *show* the splash — that is already in HTML.
 * Session navigations skip. Reduced motion keeps the splash, then hides instantly.
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
  const coldLaunchRef = useRef(false);
  const exitStartedRef = useRef(false);

  const reportInitialShellReady = useCallback(() => {
    setShellReady(true);
  }, []);

  const beginExit = useCallback(() => {
    if (exitStartedRef.current) {
      return;
    }
    exitStartedRef.current = true;
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
    const skip = shouldSkipLaunchSplash({
      reducedMotion: prefersReducedMotionMedia(),
      alreadySeen: readLaunchSplashSeen(),
      standalone: isStandaloneDisplayMode(),
    });

    if (skip) {
      coldLaunchRef.current = false;
      const id = window.setTimeout(() => setPhase("hidden"), 0);
      return () => window.clearTimeout(id);
    }

    coldLaunchRef.current = true;
    markLaunchSplashSeen();
    const maxTimer = window.setTimeout(beginExit, SPLASH_MAX_MS);
    return () => window.clearTimeout(maxTimer);
  }, [beginExit]);

  useEffect(() => {
    if (!coldLaunchRef.current || phase !== "visible" || !shellReady) {
      return;
    }
    return afterNextPaint(beginExit);
  }, [shellReady, phase, beginExit]);

  useEffect(() => {
    if (phase !== "exit") {
      return;
    }

    const timer = window.setTimeout(() => setPhase("hidden"), SPLASH_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const showOwnedSplash = ownsSplash && (phase === "visible" || phase === "exit");
  const launchReady = phase === "hidden";

  return (
    <AppLaunchReadyProvider
      ready={launchReady}
      reportInitialShellReady={reportInitialShellReady}
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
        >
          <div className="app-launch-splash__logo">
            <Logo variant="splash" decorative />
          </div>
        </div>
      ) : null}
      <div className="app-content-shell" data-testid="app-content-shell">
        {children}
      </div>
    </AppLaunchReadyProvider>
  );
}
