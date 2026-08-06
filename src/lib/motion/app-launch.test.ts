import { describe, expect, it } from "vitest";

import {
  APP_LAUNCH_SPLASH_SEEN_KEY,
  shouldSkipLaunchSplash,
  SPLASH_FADE_MS,
  SPLASH_MAX_MS,
} from "@/lib/motion/app-launch";

describe("app-launch", () => {
  it("uses a stable session storage key", () => {
    expect(APP_LAUNCH_SPLASH_SEEN_KEY).toBe("switch-it:launch-splash-seen");
  });

  it("defines fade and safety-max without an artificial minimum", () => {
    expect(SPLASH_FADE_MS).toBeGreaterThan(0);
    expect(SPLASH_MAX_MS).toBeGreaterThan(SPLASH_FADE_MS);
  });

  it("skips splash when reduced motion is preferred", () => {
    expect(
      shouldSkipLaunchSplash({ reducedMotion: true, alreadySeen: false }),
    ).toBe(true);
  });

  it("skips splash when already seen this session", () => {
    expect(
      shouldSkipLaunchSplash({ reducedMotion: false, alreadySeen: true }),
    ).toBe(true);
  });

  it("shows splash on first cold launch without reduced motion", () => {
    expect(
      shouldSkipLaunchSplash({ reducedMotion: false, alreadySeen: false }),
    ).toBe(false);
  });
});
