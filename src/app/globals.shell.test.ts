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
    expect(css).toContain("@supports (top: env(safe-area-inset-top))");
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
    expect(css).toContain(".app-shell-header-inner");
    expect(css).toMatch(
      /\.app-shell-header-inner\s*\{[^}]*max-width:\s*none/s,
    );
    expect(css).not.toContain("app-shell-header-inner--contained");
    expect(css).not.toContain("app-shell-header-inner--wide");
    expect(css).toContain("padding-top: constant(safe-area-inset-top)");
    expect(css).toContain("padding-top: var(--app-safe-top, env(safe-area-inset-top, 0px))");
    expect(css).toContain('html[data-native-status-bar="inset"] .app-shell-header');
    expect(css).toContain(".app-shell-main");
    expect(css).toContain("min-height: 0");
    expect(css).toContain(".app-shell-main--map");
    expect(css).toContain(".app-shell-main--page");
    expect(css).toContain("padding-inline: var(--app-phone-gutter)");
    expect(css).toContain(".app-overlay-pad-bottom");
  });

  it("defines seeker map bottom-stack tokens and utilities", () => {
    expect(css).toContain("--map-edge-gap:");
    expect(css).toContain("--map-attribution-clearance:");
    expect(css).toContain("--map-bottom-sheet-gap:");
    expect(css).toContain("--map-floating-control-bottom:");
    expect(css).toContain("--map-carousel-bottom:");
    expect(css).toContain('[data-map-bottom="carousel"]');
    expect(css).toContain('[data-map-bottom="selected"]');
    expect(css).toContain('[data-map-bottom="compose"]');
    expect(css).toContain("--map-compose-sheet-clearance");
    expect(css).toContain('[data-map-bottom="claim-collapsed"]');
    expect(css).toContain('[data-map-bottom="claim-expanded"]');
    expect(css).toContain("--map-claim-expanded-clearance");
    expect(css).not.toContain("min(42dvh, 16rem)");
    expect(css).toContain(".map-floating-control");
    expect(css).toContain(".map-carousel");
    expect(css).toContain(".map-bottom-sheet");
    expect(css).toContain(".map-bottom-sheet-scroll");
    expect(css).toContain("78dvh");
    expect(css).toContain(
      ".map-bottom-sheet--claim-expanded .map-bottom-sheet-actions",
    );
    expect(css).not.toMatch(
      /\.map-bottom-sheet--claim-expanded[\s\S]*?\.map-bottom-sheet-actions[\s\S]*?position:\s*sticky/,
    );
    expect(css).not.toContain("bottom-28");
    expect(css).not.toContain("46vh");
  });

  it("keeps overlay sheets inside the viewport with safe-area padding and inner scroll", () => {
    expect(css).toContain(
      "padding-top: max(1.25rem, calc(var(--app-safe-top) + 0.75rem))",
    );
    expect(css).toContain(".cancellation-sheet");
    expect(css).toContain("100dvh");
    expect(css).toContain(".cancellation-sheet__header");
    expect(css).toContain(".cancellation-sheet__reasons");
    expect(css).toContain(".cancellation-sheet__actions");
    expect(css).toMatch(
      /\.cancellation-sheet__reasons\s*\{[^}]*overflow-y:\s*auto/s,
    );
    expect(css).toMatch(
      /\.cancellation-sheet__actions\s*\{[^}]*flex-shrink:\s*0/s,
    );
    expect(css).toMatch(
      /\.cancellation-sheet__form\s*\{[^}]*flex:\s*1\s+1\s+0/s,
    );
    expect(css).not.toContain(".cancellation-sheet__form > fieldset");
    expect(css).toContain("--map-selected-sheet-clearance: 8.75rem");
  });

  it("defines publisher compose and leaver picker shell utilities", () => {
    expect(css).toContain(".leaver-map-picker-shell");
    expect(css).toContain(".leaver-map-picker-shell--fill");
    expect(css).toContain("clamp(280px, 48dvh, 400px)");
    expect(css).toContain(".publisher-compose");
    expect(css).toContain(".publisher-compose--map-first");
    expect(css).toContain(".publisher-compose-search");
    expect(css).toContain(".publisher-compose-surface");
    expect(css).not.toContain(".publisher-compose-actions--viewport");
    expect(css).not.toContain(".publisher-compose--viewport-cta");
    expect(css).not.toContain("--publisher-compose-actions-height");
    expect(css).toContain(".publisher-leave-time-grid");
    expect(css).toContain(".leave-time-range");
    expect(css).toContain(".leave-time-slider-track");
    expect(css).toContain(".publisher-share-cta");
    expect(css).toContain(".publisher-preview-map-shell--available");
    expect(css).toContain(".publisher-preview-map-shell--claimed");
    expect(css).toContain(".publisher-preview-map-shell--handoff");
    expect(css).toContain(".publisher-live-map-shell--collapsed");
    expect(css).toContain(".publisher-live-map-shell--expanded");
    expect(css).toContain(".publisher-spot-card");
    expect(css).toMatch(
      /\.publisher-location-summary__warning\s*\{[^}]*color:\s*var\(--color-accent-hover\)/s,
    );
    expect(css).not.toMatch(
      /\.publisher-location-summary__warning\s*\{[^}]*color:\s*var\(--color-warning\)/s,
    );
  });

  it("clears motion entrance transforms so MapLibre is not left in a containing block", () => {
    expect(css).toMatch(
      /@keyframes motion-fade-slide-up[\s\S]*?to\s*\{[^}]*transform:\s*none/s,
    );
    expect(css).toMatch(
      /@keyframes motion-mode-content[\s\S]*?to\s*\{[^}]*transform:\s*none/s,
    );
  });

  it("defines mobile account form utilities", () => {
    expect(css).toContain(".landing-page");
    expect(css).toContain(".landing-page__brand");
    expect(css).toContain(".landing-page__actions");
    expect(css).toContain(".auth-page");
    expect(css).toContain("justify-content: flex-start");
    expect(css).toContain("overflow-x: hidden");
    expect(css).toContain(".mobile-form-surface");
    expect(css).toContain(".mobile-form-fields");
    expect(css).toContain(".mobile-form-primary");
    expect(css).toContain(".mobile-form-section");
    expect(css).toContain(".profile-page");
    expect(css).toContain(".help-page");
    expect(css).toContain(".app-form-control");
    expect(css).toContain("font-size: max(1rem, 16px)");
    expect(css).toMatch(
      /\.plate-suffix-input\s*\{[^}]*border:\s*1px solid var\(--color-border\)[^}]*background:\s*var\(--color-surface\)/s,
    );
    expect(css).toContain(".profile-summary-grid");
    expect(css).toMatch(
      /\.profile-summary-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s,
    );
    expect(css).toMatch(
      /\.profile-summary-grid\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/s,
    );
    expect(css).not.toContain(".profile-summary-email");
    expect(css).toContain(".onboarding-vehicle-form");
  });

  it("defines branded app launch and page entry motion utilities", () => {
    expect(css).toContain("--motion-splash:");
    expect(css).toContain("--motion-splash-fade:");
    expect(css).toContain("--motion-route:");
    expect(css).toContain(".app-launch-splash");
    expect(css).toContain("background: #dff4ff");
    expect(css).toContain(".switch-it-logo--splash");
    expect(css).toContain("min(80vw, 22rem)");
    expect(css).toContain(".app-content-shell");
    expect(css).toContain("#app-boot-splash");
    expect(css).toContain("#app-root");
    expect(css).toContain("app-boot-splash-skip");
    expect(css).toContain("app-boot-splash-hidden");
    expect(css).toContain(".motion-page-enter");
    expect(css).toContain(".motion-page-header");
    expect(css).toContain(".switch-it-logo");
    expect(css).toContain("background: transparent");
    expect(css).toContain(".switch-it-logo--hero");
    expect(css).toContain(".switch-it-logo--auth");
    expect(css).toContain(".switch-it-logo--nav");
    expect(css).toContain(".auth-brand");
    expect(css).toContain(".map-route-transition");
    expect(css).toContain(".route-transition-overlay");
    expect(css).toContain(".branded-loading-page");
    expect(css).toContain(".branded-loading-car");
    expect(css).not.toContain(".map-loading-pin");
    expect(css).toContain("color-scheme: only light");
    expect(css).toContain("background-color: #dff4ff");
    expect(css).not.toMatch(
      /\.app-launch-splash\s*\{\s*display:\s*none\s*!important/,
    );
  });
});
