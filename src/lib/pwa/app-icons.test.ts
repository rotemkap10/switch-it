import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

function pngSize(path: string): { width: number; height: number; colorType: number } {
  const bytes = readFileSync(path);
  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25],
  };
}

const ICONS = {
  apple: resolve(process.cwd(), "public/apple-touch-icon.png"),
  icon192: resolve(process.cwd(), "public/pwa/icon-192.png"),
  icon512: resolve(process.cwd(), "public/pwa/icon-512.png"),
  maskable: resolve(process.cwd(), "public/pwa/icon-maskable-512.png"),
} as const;

describe("static Home Screen / PWA icons", () => {
  it("ships opaque square PNGs at the production paths iOS and the manifest request", () => {
    expect(existsSync(ICONS.apple)).toBe(true);
    expect(pngSize(ICONS.apple)).toEqual({ width: 180, height: 180, colorType: 6 });

    expect(pngSize(ICONS.icon192)).toEqual({ width: 192, height: 192, colorType: 6 });
    expect(pngSize(ICONS.icon512)).toEqual({ width: 512, height: 512, colorType: 6 });
    expect(pngSize(ICONS.maskable)).toEqual({ width: 512, height: 512, colorType: 6 });
  });

  it("does not use the old ImageResponse apple-icon or wordmark icon routes", () => {
    expect(existsSync(resolve(process.cwd(), "src/app/apple-icon.tsx"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "src/app/icon.tsx"))).toBe(false);
    expect(
      existsSync(resolve(process.cwd(), "src/app/pwa/icon-192/route.tsx")),
    ).toBe(false);
    expect(
      existsSync(resolve(process.cwd(), "src/lib/pwa/logo-icon-response.tsx")),
    ).toBe(false);
  });

  it("points the manifest at the static square-mark PNGs", () => {
    const icons = manifest().icons ?? [];
    expect(icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/pwa/icon-192.png",
          sizes: "192x192",
          purpose: "any",
        }),
        expect.objectContaining({
          src: "/pwa/icon-512.png",
          sizes: "512x512",
          purpose: "any",
        }),
        expect.objectContaining({
          src: "/pwa/icon-maskable-512.png",
          sizes: "512x512",
          purpose: "maskable",
        }),
      ]),
    );
    expect(icons.some((icon) => icon.src === "/pwa/icon-192")).toBe(false);
    expect(icons.some((icon) => icon.src === "/pwa/icon-512-maskable")).toBe(false);
  });

  it("declares apple-touch-icon.png in the root layout", () => {
    const layout = readFileSync(resolve(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout).toContain('rel="apple-touch-icon"');
    expect(layout).toContain("/apple-touch-icon.png");
    expect(layout).toContain('sizes: "180x180"');
  });
});
