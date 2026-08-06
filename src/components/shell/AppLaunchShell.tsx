"use client";

import { useEffect, useState, type ReactNode } from "react";

import { SwitchItLogoMark } from "@/components/brand/SwitchItLogoMark";
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
 * Branded cold-start splash for document / PWA launches only.
 * No artificial minimum duration — exits as soon as the document is ready,
 * with a safety max timeout to prevent a stuck overlay.
 * Does not replay on soft client navigations (sessionStorage guard).
 */
export function AppLaunchShell({ children }: AppLaunchShellProps) {
  // Always paint branded boot on first frame (SSR + hydration match).
  // Effect then skips/exits for warm session or reduced motion.
  const [phase, setPhase] = useState<SplashPhase>("visible");

  useEffect(() => {
    const skip = shouldSkipLaunchSplash({
      reducedMotion: prefersReducedMotionMedia(),
      alreadySeen: readLaunchSplashSeen(),
    });

    if (skip) {
      const id = window.setTimeout(() => setPhase("hidden"), 0);
      return () => window.clearTimeout(id);
    }

    markLaunchSplashSeen();

    let cancelled = false;
    let exitStarted = false;

    function beginExit() {
      if (cancelled || exitStarted) {
        return;
      }
      exitStarted = true;
      setPhase("exit");
    }

    // Exit as soon as the document is ready — no artificial minimum.
    if (document.readyState === "complete") {
      // Yield one frame so the branded first paint can show, then exit.
      const raf = window.requestAnimationFrame(() => beginExit());
      const maxTimer = window.setTimeout(beginExit, SPLASH_MAX_MS);
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(raf);
        window.clearTimeout(maxTimer);
      };
    }

    window.addEventListener("load", beginExit, { once: true });
    const maxTimer = window.setTimeout(beginExit, SPLASH_MAX_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(maxTimer);
      window.removeEventListener("load", beginExit);
    };
  }, []);

  useEffect(() => {
    if (phase !== "exit") {
      return;
    }

    const timer = window.setTimeout(() => setPhase("hidden"), SPLASH_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const showSplash = phase === "visible" || phase === "exit";
  const contentClass =
    phase === "hidden"
      ? "app-content-shell is-ready"
      : phase === "exit"
        ? "app-content-shell is-revealing"
        : "app-content-shell is-waiting";

  return (
    <>
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
        >
          <div className="app-launch-splash__logo motion-launch-logo">
            <SwitchItLogoMark size={88} />
          </div>
          <p className="app-launch-splash__wordmark">Switch It</p>
        </div>
      ) : null}
      <div className={contentClass} data-testid="app-content-shell">
        {children}
      </div>
    </>
  );
}
