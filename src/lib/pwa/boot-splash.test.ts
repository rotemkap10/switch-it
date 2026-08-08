import { describe, expect, it } from "vitest";

import { APP_LAUNCH_SPLASH_SEEN_KEY } from "@/lib/motion/app-launch";
import {
  APP_ROOT_ID,
  BOOT_SPLASH_HIDDEN_CLASS,
  BOOT_SPLASH_ID,
  BOOT_SPLASH_SKIP_CLASS,
  bootSplashCriticalCss,
  bootSplashSkipScript,
} from "@/lib/pwa/boot-splash";
import { PWA_BACKGROUND_COLOR } from "@/lib/pwa/brand-colors";

describe("boot splash first-paint helpers", () => {
  it("inlines the light brand fill on html, body, root, and splash", () => {
    const css = bootSplashCriticalCss();
    expect(PWA_BACKGROUND_COLOR).toBe("#dff4ff");
    expect(css).toContain(`#${BOOT_SPLASH_ID}`);
    expect(css).toContain(`#${APP_ROOT_ID}`);
    expect(css).toContain(`${PWA_BACKGROUND_COLOR}!important`);
    expect(css).toContain("color-scheme: only light");
    expect(css).toContain("@media (prefers-color-scheme:dark)");
    expect(css).toContain(`.${BOOT_SPLASH_SKIP_CLASS}`);
    expect(css).toContain(`.${BOOT_SPLASH_HIDDEN_CLASS}`);
  });

  it("skips splash from sessionStorage before React hydrates", () => {
    const script = bootSplashSkipScript();
    expect(script).toContain(APP_LAUNCH_SPLASH_SEEN_KEY);
    expect(script).toContain(BOOT_SPLASH_SKIP_CLASS);
    expect(script).toContain("sessionStorage");
  });
});
