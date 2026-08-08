"use client";

import { useEffect } from "react";

import {
  IOS_STARTUP_FALLBACK,
  IOS_STARTUP_IMAGES,
} from "@/lib/pwa/ios-startup";

type StartupDebugSnapshot = {
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  innerWidth: number;
  innerHeight: number;
  standalone: boolean;
  displayModeStandalone: boolean;
  matchingStartupImages: string[];
  fallbackHref: string;
};

function snapshot(): StartupDebugSnapshot {
  const standaloneNav = Boolean(
    "standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone,
  );
  const displayModeStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;

  return {
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    standalone: standaloneNav,
    displayModeStandalone,
    matchingStartupImages:
      typeof window.matchMedia === "function"
        ? IOS_STARTUP_IMAGES.filter((image) =>
            window.matchMedia(image.media).matches,
          ).map((image) => image.fileName)
        : [],
    fallbackHref: IOS_STARTUP_FALLBACK.href,
  };
}

/**
 * Development-only: logs which iOS startup media queries match this viewport.
 * Also exposes window.__switchItIosStartupDebug() for Safari Web Inspector.
 * Stripped from production builds.
 */
export function IosStartupDebugProbe() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    const info = snapshot();
    if (typeof console !== "undefined" && console.info) {
      console.info("[Switch It iOS startup]", info);
    }
    (
      window as Window & {
        __switchItIosStartupDebug?: () => StartupDebugSnapshot;
      }
    ).__switchItIosStartupDebug = snapshot;
  }, []);

  return null;
}
