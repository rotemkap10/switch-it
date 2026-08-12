import { afterEach, describe, expect, it } from "vitest";

import {
  ensureViewportFitCover,
  measureSafeAreaInsets,
  safeAreaBootstrapScript,
  syncSafeAreaInsetCssVars,
} from "@/lib/native/safe-area";
import {
  markNativeStatusBarInsetOwned,
  NATIVE_STATUS_BAR_INSET_ATTR,
} from "@/lib/native/status-bar";

describe("safe-area helpers", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--app-safe-top");
    document.documentElement.style.removeProperty("--app-safe-bottom");
    document.documentElement.style.removeProperty("--app-safe-left");
    document.documentElement.style.removeProperty("--app-safe-right");
    document.documentElement.removeAttribute(NATIVE_STATUS_BAR_INSET_ATTR);
    document.head.innerHTML = "";
  });

  it("appends viewport-fit=cover to the existing viewport meta instead of duplicating it", () => {
    document.head.innerHTML =
      '<meta name="viewport" content="width=device-width, initial-scale=1" />';

    ensureViewportFitCover();

    const meta = document.querySelector('meta[name="viewport"]');
    expect(meta?.getAttribute("content")).toBe(
      "width=device-width, initial-scale=1, viewport-fit=cover",
    );
    expect(document.querySelectorAll('meta[name="viewport"]')).toHaveLength(1);
  });

  it("leaves viewport meta unchanged when viewport-fit=cover is already present", () => {
    document.head.innerHTML =
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />';

    ensureViewportFitCover();

    expect(document.querySelector('meta[name="viewport"]')?.getAttribute("content")).toBe(
      "width=device-width, initial-scale=1, viewport-fit=cover",
    );
  });

  it("syncs safe-area tokens on the html element", () => {
    const insets = syncSafeAreaInsetCssVars();

    expect(insets.top).toBeGreaterThanOrEqual(0);
    expect(document.documentElement.style.getPropertyValue("--app-safe-top")).toBe(
      `${insets.top}px`,
    );
    expect(document.documentElement.style.getPropertyValue("--app-safe-bottom")).toBe(
      `${insets.bottom}px`,
    );
  });

  it("measures zero insets in jsdom when env() is unavailable", () => {
    expect(measureSafeAreaInsets()).toEqual({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });
  });

  it("ships a beforeInteractive bootstrap script for first paint", () => {
    const script = safeAreaBootstrapScript();
    expect(script).toContain("viewport-fit=cover");
    expect(script).toContain("--app-safe-top");
    expect(script).toContain("safe-area-inset-top");
  });

  it("zeros --app-safe-top when native iOS status bar already insets the WebView", () => {
    markNativeStatusBarInsetOwned();
    const insets = syncSafeAreaInsetCssVars();
    expect(insets.top).toBe(0);
    expect(document.documentElement.style.getPropertyValue("--app-safe-top")).toBe(
      "0px",
    );
  });
});
