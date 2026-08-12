import { describe, expect, it, vi } from "vitest";

import {
  afterNextPaint,
  APP_LAUNCH_SPLASH_SEEN_KEY,
  shouldSkipLaunchSplash,
  SPLASH_FADE_MS,
  SPLASH_MAX_MS,
} from "@/lib/motion/app-launch";

describe("app-launch", () => {
  it("uses a stable session storage key", () => {
    expect(APP_LAUNCH_SPLASH_SEEN_KEY).toBe("switch-it:launch-splash-seen");
  });

  it("defines fade and a long safety max without an artificial minimum", () => {
    expect(SPLASH_FADE_MS).toBeGreaterThan(0);
    expect(SPLASH_MAX_MS).toBeGreaterThan(10_000);
    expect(SPLASH_MAX_MS).toBeGreaterThan(SPLASH_FADE_MS);
  });

  it("does not skip cold-start splash only because reduced motion is preferred", () => {
    expect(
      shouldSkipLaunchSplash({ reducedMotion: true, alreadySeen: false }),
    ).toBe(false);
  });

  it("skips splash when already seen this session in the browser", () => {
    expect(
      shouldSkipLaunchSplash({ reducedMotion: false, alreadySeen: true }),
    ).toBe(true);
  });

  it("does not skip splash on standalone PWA launch even if already seen", () => {
    expect(
      shouldSkipLaunchSplash({
        reducedMotion: false,
        alreadySeen: true,
        standalone: true,
      }),
    ).toBe(false);
  });

  it("does not skip splash on Capacitor native cold launch even if already seen", () => {
    expect(
      shouldSkipLaunchSplash({
        reducedMotion: false,
        alreadySeen: true,
        nativeCapacitor: true,
      }),
    ).toBe(false);
  });

  it("shows splash on first cold launch without reduced motion", () => {
    expect(
      shouldSkipLaunchSplash({ reducedMotion: false, alreadySeen: false }),
    ).toBe(false);
  });

  it("runs afterNextPaint on the second animation frame", () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    let id = 0;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      id += 1;
      window.setTimeout(() => cb(id), 0);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (timerId: number) => {
      window.clearTimeout(timerId);
    });

    afterNextPaint(() => {
      calls.push(1);
    });
    expect(calls).toEqual([]);
    vi.runOnlyPendingTimers();
    expect(calls).toEqual([]);
    vi.runOnlyPendingTimers();
    expect(calls).toEqual([1]);

    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
