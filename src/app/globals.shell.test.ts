import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("mobile shell CSS foundation", () => {
  const css = readFileSync(
    resolve(process.cwd(), "src/app/globals.css"),
    "utf8",
  );

  it("defines safe-area and spacing tokens without a fixed 3.5rem layout header", () => {
    expect(css).toContain("--app-safe-top:");
    expect(css).toContain("--app-safe-bottom:");
    expect(css).toContain("--app-phone-gutter:");
    expect(css).toContain("--app-card-gap:");
    expect(css).toContain("--app-section-gap:");
    expect(css).toContain("--app-overlay-bottom-gap:");
    expect(css).toContain("--app-tap-min:");
    expect(css).toContain("--app-toast-offset:");
    expect(css).toContain("--app-desktop-header-offset:");
    expect(css).not.toMatch(/--app-header-height:\s*3\.5rem/);
  });

  it("provides flex shell utilities for map and page layouts", () => {
    expect(css).toContain(".app-shell");
    expect(css).toContain(".app-shell--map");
    expect(css).toContain("height: 100dvh");
    expect(css).toContain(".app-shell-header");
    expect(css).toContain("padding-top: var(--app-safe-top)");
    expect(css).toContain(".app-shell-main");
    expect(css).toContain("min-height: 0");
    expect(css).toContain(".app-shell-main--map");
    expect(css).toContain(".app-shell-main--page");
    expect(css).toContain("padding-inline: var(--app-phone-gutter)");
    expect(css).toContain(".app-overlay-pad-bottom");
  });
});
