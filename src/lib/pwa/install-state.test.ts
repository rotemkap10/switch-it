import { describe, expect, it, vi } from "vitest";

import {
  isIosAddToHomeScreenEligible,
  isStandaloneDisplayMode,
  resolvePwaInstallCapability,
  shouldShowInstallMenuItem,
} from "@/lib/pwa/install-state";

describe("PWA install-state", () => {
  it("hides install entry while client state is unknown", () => {
    expect(
      resolvePwaInstallCapability({
        clientReady: false,
        standalone: false,
        hasDeferredPrompt: true,
        iosEligible: true,
      }),
    ).toBe("unknown");
    expect(shouldShowInstallMenuItem("unknown")).toBe(false);
  });

  it("hides install entry in standalone mode", () => {
    expect(
      resolvePwaInstallCapability({
        clientReady: true,
        standalone: true,
        hasDeferredPrompt: true,
        iosEligible: true,
      }),
    ).toBe("standalone");
    expect(shouldShowInstallMenuItem("standalone")).toBe(false);
  });

  it("prefers Chromium install prompt when available", () => {
    expect(
      resolvePwaInstallCapability({
        clientReady: true,
        standalone: false,
        hasDeferredPrompt: true,
        iosEligible: true,
      }),
    ).toBe("chromium-installable");
    expect(shouldShowInstallMenuItem("chromium-installable")).toBe(true);
  });

  it("falls back to iOS instructions when eligible", () => {
    expect(
      resolvePwaInstallCapability({
        clientReady: true,
        standalone: false,
        hasDeferredPrompt: false,
        iosEligible: true,
      }),
    ).toBe("ios-instructions");
    expect(shouldShowInstallMenuItem("ios-instructions")).toBe(true);
  });

  it("detects standalone display mode from matchMedia", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("standalone"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.stubGlobal("navigator", { ...navigator, standalone: false });

    expect(isStandaloneDisplayMode()).toBe(true);
    vi.unstubAllGlobals();
  });

  it("detects iOS Add to Home Screen eligibility", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      maxTouchPoints: 5,
      standalone: false,
    });
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      media: "",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    expect(isIosAddToHomeScreenEligible()).toBe(true);
    vi.unstubAllGlobals();
  });
});
