"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { SwitchItLogoMark } from "@/components/brand/SwitchItLogoMark";
import { AppLaunchReadyProvider } from "@/components/shell/AppLaunchReadyContext";
import { IosStartupDebugProbe } from "@/components/shell/IosStartupDebugProbe";
import {
  markLaunchSplashSeen,
  prefersReducedMotionMedia,
  readLaunchSplashSeen,
  shouldSkipLaunchSplash,
  SPLASH_FADE_MS,
  SPLASH_MAX_MS,
} from "@/lib/motion/app-launch";

type SplashPhase = "visible" | "exit" | "hidden";

type AppLaunchShellProps = {
  children: ReactNode;
};

/**
 * Branded cold-start splash. Stays until the initial application shell reports
 * ready (not merely hydration / document load), then fades into the first screen.
 * Session navigations skip. Reduced motion keeps the splash, then hides instantly.
 */
export function AppLaunchShell({ children }: AppLaunchShellProps) {
  const [phase, setPhase] = useState<SplashPhase>("visible");
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

  useEffect(() => {
    const skip = shouldSkipLaunchSplash({
      reducedMotion: prefersReducedMotionMedia(),
      alreadySeen: readLaunchSplashSeen(),
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
    beginExit();
  }, [shellReady, phase, beginExit]);

  useEffect(() => {
    if (phase !== "exit") {
      return;
    }

    const timer = window.setTimeout(() => setPhase("hidden"), SPLASH_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const showSplash = phase === "visible" || phase === "exit";
  const launchReady = phase === "hidden";
  const contentClass =
    phase === "hidden"
      ? "app-content-shell is-ready"
      : phase === "exit"
        ? "app-content-shell is-revealing"
        : "app-content-shell is-waiting";

  return (
    <AppLaunchReadyProvider
      ready={launchReady}
      reportInitialShellReady={reportInitialShellReady}
    >
      {process.env.NODE_ENV !== "production" ? <IosStartupDebugProbe /> : null}
      {showSplash ? (
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
            <SwitchItLogoMark size={88} />
          </div>
          <p className="app-launch-splash__wordmark">Switch It</p>
        </div>
      ) : null}
      <div className={contentClass} data-testid="app-content-shell">
        {children}
      </div>
    </AppLaunchReadyProvider>
  );
}
