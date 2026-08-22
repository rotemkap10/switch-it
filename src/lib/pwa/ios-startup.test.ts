import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { bootSplashCriticalCss } from "@/lib/pwa/boot-splash";
import { PWA_BACKGROUND_COLOR } from "@/lib/pwa/brand-colors";
import {
  allIosStartupHrefs,
  iosStartupLogoCssPx,
  IOS_STARTUP_FALLBACK,
  IOS_STARTUP_IMAGES,
  iosStartupAppleWebAppImages,
} from "@/lib/pwa/ios-startup";

function pngSignature(path: string) {
  const header = readFileSync(path).subarray(0, 8);
  return Uint8Array.from(header);
}

describe("iOS startup images", () => {
  it("declares launch sizes with exact device media queries", () => {
    expect(IOS_STARTUP_IMAGES.length).toBeGreaterThanOrEqual(20);
    for (const image of IOS_STARTUP_IMAGES) {
      expect(image.href).toBe(`/pwa/startup/${image.fileName}`);
      expect(image.media).toContain(`device-width: ${image.cssWidth}px`);
      expect(image.media).toContain(`device-height: ${image.cssHeight}px`);
      expect(image.media).toContain(`-webkit-device-pixel-ratio: ${image.scale}`);
      expect(image.media).toContain(`orientation: ${image.orientation}`);
      expect(image.devices.length).toBeGreaterThan(0);
      if (image.orientation === "portrait") {
        expect(image.width).toBe(image.cssWidth * image.scale);
        expect(image.height).toBe(image.cssHeight * image.scale);
      } else {
        expect(image.width).toBe(image.cssHeight * image.scale);
        expect(image.height).toBe(image.cssWidth * image.scale);
      }
    }
  });

  it("sizes the logo at ~72% of the shorter viewport side", () => {
    expect(iosStartupLogoCssPx(390, 844)).toBe(281);
    expect(iosStartupLogoCssPx(852, 393)).toBe(283);
  });

  it("covers current common iPhone CSS sizes in portrait and landscape", () => {
    const portrait = IOS_STARTUP_IMAGES.filter(
      (image) => image.orientation === "portrait",
    );
    const landscape = IOS_STARTUP_IMAGES.filter(
      (image) => image.orientation === "landscape",
    );
    expect(portrait.length).toBe(landscape.length);
    expect(portrait.length).toBeGreaterThanOrEqual(10);

    const keys = portrait.map(
      (image) => `${image.cssWidth}x${image.cssHeight}@${image.scale}`,
    );
    expect(keys).toEqual(
      expect.arrayContaining([
        "320x568@2",
        "375x667@2",
        "390x844@3",
        "393x852@3",
        "430x932@3",
        "402x874@3",
        "440x956@3",
        "420x912@3",
      ]),
    );

    const landscapeSample = landscape.find(
      (image) => image.cssWidth === 393 && image.cssHeight === 852,
    );
    expect(landscapeSample?.width).toBe(852 * 3);
    expect(landscapeSample?.height).toBe(393 * 3);
    expect(landscapeSample?.media).toContain("orientation: landscape");
  });

  it("declares an unqualified portrait fallback with no media query", () => {
    expect(IOS_STARTUP_FALLBACK.media).toBeNull();
    expect(IOS_STARTUP_FALLBACK.href).toBe(
      "/pwa/startup/iphone-portrait-fallback.png",
    );
    expect(IOS_STARTUP_FALLBACK.width).toBe(1290);
    expect(IOS_STARTUP_FALLBACK.height).toBe(2796);
  });

  it("maps specifics then fallback for Apple web app descriptors", () => {
    const descriptors = iosStartupAppleWebAppImages();
    expect(descriptors).toHaveLength(IOS_STARTUP_IMAGES.length + 1);
    expect(descriptors[0]).toEqual({
      url: IOS_STARTUP_IMAGES[0].href,
      media: IOS_STARTUP_IMAGES[0].media,
    });
    expect(descriptors.at(-1)).toEqual({ url: IOS_STARTUP_FALLBACK.href });
    expect(descriptors.at(-1)).not.toHaveProperty("media");
  });

  it("ships static PNG assets for every declared size including fallback", () => {
    const pngMagic = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    for (const href of allIosStartupHrefs()) {
      const fileName = href.replace("/pwa/startup/", "");
      const path = resolve(process.cwd(), "public/pwa/startup", fileName);
      expect(existsSync(path), `missing ${fileName}`).toBe(true);
      expect(pngSignature(path)).toEqual(pngMagic);
    }
  });

  it("does not fetch remote/network images in the generator markup", () => {
    const markup = readFileSync(
      resolve(process.cwd(), "src/lib/pwa/startup-splash-markup.tsx"),
      "utf8",
    );
    expect(markup).toContain("public/branding/switch-it-logo.png");
    expect(markup).toContain("PWA_BACKGROUND_COLOR");
    expect(markup).toContain("containedLogoSize");
    expect(markup).not.toMatch(/https?:\/\//);
  });
});

describe("root layout iOS launch metadata", () => {
  const layout = readFileSync(
    resolve(process.cwd(), "src/app/layout.tsx"),
    "utf8",
  );

  it("declares apple-touch startup images, fallback last, and light-only color scheme", () => {
    expect(layout).toContain('rel="apple-touch-startup-image"');
    expect(layout).toContain("IOS_STARTUP_IMAGES.map");
    expect(layout).toContain("IOS_STARTUP_FALLBACK.href");
    expect(layout.indexOf("IOS_STARTUP_IMAGES.map")).toBeLessThan(
      layout.indexOf("IOS_STARTUP_FALLBACK.href"),
    );
    expect(layout).toContain('"color-scheme": "only light"');
    expect(bootSplashCriticalCss()).toContain("color-scheme: only light");
    expect(layout).toContain('"supported-color-schemes": "light"');
    expect(layout).toContain('statusBarStyle: "default"');
    expect(layout).toContain('content="default"');
    expect(layout).toContain('apple-mobile-web-app-capable');
    expect(layout).toContain('content="yes"');
  });

  it("uses the light brand fill for theme-color in light and dark schemes", () => {
    expect(layout).toContain('media: "(prefers-color-scheme: light)"');
    expect(layout).toContain('media: "(prefers-color-scheme: dark)"');
    expect(layout).toContain("color: PWA_BACKGROUND_COLOR");
    expect(PWA_BACKGROUND_COLOR).toBe("#F8F7F4");
    expect(IOS_STARTUP_FALLBACK.href).toContain("pwa/startup");
  });
});
