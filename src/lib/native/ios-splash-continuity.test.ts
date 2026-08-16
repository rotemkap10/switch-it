import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { BOOT_SPLASH_ID } from "@/lib/pwa/boot-splash";
import { waitForWebBootSplashPainted } from "@/lib/native/wait-for-boot-splash-paint";

describe("Capacitor SplashScreen continuity config", () => {
  it("keeps launchShowDuration > 0 so iOS attaches the LaunchScreen overlay", () => {
    const source = readFileSync(
      resolve(process.cwd(), "capacitor.config.ts"),
      "utf8",
    );
    expect(source).toMatch(/launchShowDuration:\s*([1-9]\d*)/);
    expect(source).not.toMatch(/launchShowDuration:\s*0\b/);
    expect(source).toContain("launchAutoHide: false");
    // Document the Capacitor early-return trap in source.
    expect(source).toContain("MUST be > 0");
  });
});

describe("waitForWebBootSplashPainted", () => {
  it("resolves after the boot splash logo is complete and two frames elapse", async () => {
    const splash = document.createElement("div");
    splash.id = BOOT_SPLASH_ID;
    const img = document.createElement("img");
    Object.defineProperty(img, "complete", { value: true });
    Object.defineProperty(img, "naturalWidth", { value: 880 });
    splash.append(img);
    document.body.append(splash);

    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      return window.setTimeout(() => cb(0), 0) as unknown as number;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      window.clearTimeout(id);
    });

    const done = waitForWebBootSplashPainted();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await done;

    splash.remove();
    vi.unstubAllGlobals();
  });
});
