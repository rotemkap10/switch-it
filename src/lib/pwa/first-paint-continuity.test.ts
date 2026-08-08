import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PWA_BACKGROUND_COLOR,
  PWA_THEME_COLOR,
} from "@/lib/pwa/brand-colors";

describe("PWA / first-paint color continuity", () => {
  it("keeps manifest, theme, and body brand colors aligned", () => {
    expect(PWA_BACKGROUND_COLOR).toBe("#dff4ff");
    expect(PWA_THEME_COLOR).toBe("#55bff3");

    const layout = readFileSync(
      resolve(process.cwd(), "src/app/layout.tsx"),
      "utf8",
    );
    expect(layout).toContain("PWA_BACKGROUND_COLOR");
    expect(layout).toContain("backgroundColor: PWA_BACKGROUND_COLOR");
    expect(layout).toContain("colorScheme: \"light\"");
    expect(layout).toContain("color-scheme:only light");
    expect(layout).toContain("supported-color-schemes");
    expect(layout).toContain("apple-touch-startup-image");
    expect(layout).toContain("IOS_STARTUP_FALLBACK");

    const manifest = readFileSync(
      resolve(process.cwd(), "src/app/manifest.ts"),
      "utf8",
    );
    expect(manifest).toContain("PWA_BACKGROUND_COLOR");
    expect(manifest).not.toContain("PWA_THEME_COLOR");

    const sw = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
    expect(sw).toContain("/offline");
    expect(sw).not.toContain("parking_spots");
    expect(sw).not.toContain("maptiler");
  });
});
