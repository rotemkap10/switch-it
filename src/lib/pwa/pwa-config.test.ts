import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import { PWA_BACKGROUND_COLOR } from "@/lib/pwa/brand-colors";
import { safeAreaBootstrapScript } from "@/lib/native/safe-area";

describe("PWA manifest", () => {
  const config = manifest();

  it("declares Switch It standalone metadata", () => {
    expect(config.name).toBe("Switch It");
    expect(config.short_name).toBe("Switch It");
    expect(config.start_url).toBe("/map");
    expect(config.scope).toBe("/");
    expect(config.display).toBe("standalone");
    expect(config.orientation).toBeUndefined();
  });

  it("uses brand theme and background colors", () => {
    expect(config.theme_color).toBe(PWA_BACKGROUND_COLOR);
    expect(config.background_color).toBe(PWA_BACKGROUND_COLOR);
  });

  it("includes icon sizes and shortcuts", () => {
    const icons = config.icons ?? [];
    expect(icons.some((icon) => icon.sizes === "192x192")).toBe(true);
    expect(
      icons.some(
        (icon) => icon.sizes === "512x512" && icon.purpose === "maskable",
      ),
    ).toBe(true);
    expect(config.shortcuts?.some((shortcut) => shortcut.url === "/map")).toBe(
      true,
    );
  });
});

describe("root PWA metadata", () => {
  const layoutSource = readFileSync(
    resolve(process.cwd(), "src/app/layout.tsx"),
    "utf8",
  );

  it("sets application name and Apple web app configuration", () => {
    expect(layoutSource).toContain('applicationName: "Switch It"');
    expect(layoutSource).toContain("appleWebApp");
    expect(layoutSource).toContain("apple-touch-startup-image");
    expect(layoutSource).toContain("apple-mobile-web-app-capable");
    expect(layoutSource).toContain('statusBarStyle: "default"');
    expect(layoutSource).toContain("/apple-touch-icon.png");
  });

  it("preserves viewport fit and light launch theme color", () => {
    expect(layoutSource).toContain('viewportFit: "cover"');
    expect(layoutSource).toContain("safeAreaBootstrapScript");
    expect(safeAreaBootstrapScript()).toContain("viewport-fit=cover");
    expect(layoutSource).toContain("PWA_BACKGROUND_COLOR");
    expect(layoutSource).toContain('colorScheme: "light"');
    expect(layoutSource).not.toContain("userScalable: false");
    expect(layoutSource).not.toContain("maximumScale");
    expect(layoutSource).not.toContain("user-scalable=no");
    expect(layoutSource).not.toContain("maximum-scale=1");
  });
});

describe("proxy PWA exclusions", () => {
  const proxySource = readFileSync(
    resolve(process.cwd(), "src/proxy.ts"),
    "utf8",
  );

  it("bypasses auth middleware for public PWA assets", () => {
    expect(proxySource).toContain("sw.js");
    expect(proxySource).toContain("manifest.webmanifest");
    expect(proxySource).toContain("offline");
    expect(proxySource).toContain("pwa/");
    expect(proxySource).toContain("png");
  });
});

describe("service worker policy", () => {
  const sw = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");

  it("precaches only approved offline and icon resources", () => {
    expect(sw).toContain('"/offline"');
    expect(sw).toContain('"/pwa/icon-192.png"');
    expect(sw).toContain('"/apple-touch-icon.png"');
    expect(sw).toContain("switch-it-pwa-v9");
    expect(sw).toContain("/branding/switch-it-logo.png");
    expect(sw).toContain("/branding/switch-it-launch-icon.png");
    expect(sw).not.toContain("iphone-portrait-fallback");
    expect(sw).not.toContain("/pwa/startup/");
  });

  it("does not cache Supabase, MapTiler, or POST traffic", () => {
    expect(sw).not.toContain("maptiler");
    expect(sw).not.toContain("supabase");
    expect(sw).toContain('request.method !== "GET"');
  });

  it("returns offline fallback only for navigation failures", () => {
    expect(sw).toContain('request.mode === "navigate"');
    expect(sw).toContain('caches.match("/offline")');
  });
});

describe("service worker registration component", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/components/pwa/ServiceWorkerRegistration.tsx"),
    "utf8",
  );

  it("registers in production with updateViaCache none", () => {
    expect(source).toContain('register("/sw.js"');
    expect(source).toContain('updateViaCache: "none"');
    expect(source).toContain("isNativeHandoffPlatform");
  });
});

describe("next.config service worker headers", () => {
  it("sets no-cache headers for sw.js", () => {
    const configSource = readFileSync(
      resolve(process.cwd(), "next.config.ts"),
      "utf8",
    );

    expect(configSource).toContain('source: "/sw.js"');
    expect(configSource).toContain("no-cache, no-store, must-revalidate");
    expect(configSource).toContain('key: "Service-Worker-Allowed"');
    expect(configSource).toContain('source: "/apple-touch-icon.png"');
  });
});
