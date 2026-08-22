import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Android MainActivity hardening", () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      "android/app/src/main/java/il/ac/runi/switchit/MainActivity.java",
    ),
    "utf8",
  );

  it("keeps a splash failsafe when launchAutoHide is false", () => {
    expect(source).toContain("SPLASH_FAILSAFE_MS");
    expect(source).toContain("runSplashFailsafe");
    expect(source).toContain("SplashScreenPlugin");
    expect(source).toContain("plugin.hide");
  });

  it("disables WebView overscroll so map fling is not stolen", () => {
    expect(source).toContain("OVER_SCROLL_NEVER");
    expect(source).toContain("setNestedScrollingEnabled(false)");
    expect(source).toContain("configureWebViewForMaps");
  });
});
