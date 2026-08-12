export const APP_LAUNCH_SPLASH_SEEN_KEY = "switch-it:launch-splash-seen";

/** Soft fade only — not a minimum display duration. */
export const SPLASH_FADE_MS = 280;

/**
 * Safety timeout so a stuck boot overlay cannot block the app forever.
 * Not an artificial minimum. Cold launch waits for the initial destination
 * (shell ready, or first usable map frame on /map) before exiting; this cap
 * still releases the splash if MapLibre/auth never settles.
 */
export const SPLASH_MAX_MS = 12_000;

export function shouldSkipLaunchSplash(options: {
  reducedMotion: boolean;
  alreadySeen: boolean;
  standalone?: boolean;
  /** Capacitor iOS/Android cold launch — always show until shell ready. */
  nativeCapacitor?: boolean;
}): boolean {
  // Reduced motion still shows the cold-start splash (avoids black/half UI);
  // it only skips the exit fade. Standalone PWA and native Capacitor cold
  // launches always show splash. In-browser client remounts skip via alreadySeen.
  void options.reducedMotion;
  if (options.standalone || options.nativeCapacitor) {
    return false;
  }
  return options.alreadySeen;
}

/** Wait until after the next two frames so the app shell can paint first. */
export function afterNextPaint(callback: () => void): () => void {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    callback();
    return () => {};
  }

  let innerId = 0;
  const outerId = window.requestAnimationFrame(() => {
    innerId = window.requestAnimationFrame(() => {
      callback();
    });
  });

  return () => {
    window.cancelAnimationFrame(outerId);
    window.cancelAnimationFrame(innerId);
  };
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
