export const APP_LAUNCH_SPLASH_SEEN_KEY = "switch-it:launch-splash-seen";

/** Soft fade only — not a minimum display duration. */
export const SPLASH_FADE_MS = 280;

/**
 * Safety timeout so a stuck boot overlay cannot block the app forever.
 * Not an artificial minimum. Cold launch waits for initial shell ready first.
 * Slow networks may keep the branded splash visible until this cap.
 */
export const SPLASH_MAX_MS = 12_000;

export function shouldSkipLaunchSplash(options: {
  reducedMotion: boolean;
  alreadySeen: boolean;
}): boolean {
  // Reduced motion still shows the cold-start splash (avoids black/half UI);
  // it only skips the exit fade. Client navigations skip via alreadySeen.
  void options.reducedMotion;
  return options.alreadySeen;
}

export function prefersReducedMotionMedia(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function readLaunchSplashSeen(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.sessionStorage.getItem(APP_LAUNCH_SPLASH_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markLaunchSplashSeen(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(APP_LAUNCH_SPLASH_SEEN_KEY, "1");
  } catch {
    // Non-blocking — splash may replay if storage is unavailable.
  }
}
