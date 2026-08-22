import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

async function analyzeLaunchMarkPng(path: string) {
  const launchPng = readFileSync(path);
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(launchPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let transparent = 0;
  let symbol = 0;
  let tileCyan = 0;
  let cornerTransparent = 0;
  const cornerSize = Math.max(4, Math.round(info.width * 0.05));

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      const inCorner =
        (x < cornerSize && y < cornerSize) ||
        (x >= info.width - cornerSize && y < cornerSize) ||
        (x < cornerSize && y >= info.height - cornerSize) ||
        (x >= info.width - cornerSize && y >= info.height - cornerSize);

      if (a < 20) {
        transparent += 1;
        if (inCorner) cornerTransparent += 1;
        continue;
      }
      if (r > 200 && g > 200 && b > 200) {
        symbol += 1;
        continue;
      }
      if (b > 130 && g > 100 && r < 200 && b >= g - 5) {
        tileCyan += 1;
      }
    }
  }

  return { data, info, transparent, symbol, tileCyan, cornerTransparent, cornerSize };
}

describe("official logo asset", () => {
  it("is a transparent horizontal lockup, not a square canvas", async () => {
    const { SWITCH_IT_LOGO_WIDTH, SWITCH_IT_LOGO_HEIGHT } = await import(
      "@/lib/branding/logo-asset"
    );

    expect(SWITCH_IT_LOGO_WIDTH).toBe(1106);
    expect(SWITCH_IT_LOGO_HEIGHT).toBe(342);
    expect(SWITCH_IT_LOGO_WIDTH / SWITCH_IT_LOGO_HEIGHT).toBeCloseTo(3.23, 1);

    const png = readFileSync(
      resolve(process.cwd(), "public/branding/switch-it-logo.png"),
    );
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(png[25]).toBe(6);
  });

  it("ships a rounded launch icon with transparent outer corners", async () => {
    const {
      SWITCH_IT_LAUNCH_MARK_SRC,
      SWITCH_IT_LAUNCH_MARK_WIDTH,
      SWITCH_IT_LAUNCH_MARK_HEIGHT,
      SWITCH_IT_LAUNCH_MARK_RATIO,
      SWITCH_IT_LAUNCH_ICON_CORNER_RADIUS_RATIO,
      launchMarkCssPx,
    } = await import("@/lib/branding/logo-asset");

    expect(SWITCH_IT_LAUNCH_MARK_SRC).toBe("/branding/switch-it-launch-mark.png");
    expect(SWITCH_IT_LAUNCH_MARK_WIDTH).toBe(SWITCH_IT_LAUNCH_MARK_HEIGHT);
    expect(SWITCH_IT_LAUNCH_MARK_RATIO).toBe(0.28);
    expect(SWITCH_IT_LAUNCH_ICON_CORNER_RADIUS_RATIO).toBeCloseTo(0.2237, 4);

    const analysis = await analyzeLaunchMarkPng(
      resolve(process.cwd(), "public/branding/switch-it-launch-mark.png"),
    );

    expect(analysis.info.width).toBe(512);
    expect(analysis.info.height).toBe(512);
    expect(analysis.transparent).toBeGreaterThan(analysis.info.width * analysis.info.height * 0.03);
    expect(analysis.symbol).toBeGreaterThan(1000);
    expect(analysis.tileCyan).toBeGreaterThan(5000);
    expect(analysis.cornerTransparent).toBeGreaterThan(analysis.cornerSize * analysis.cornerSize * 3);
    expect(launchMarkCssPx(390, 844)).toBe(109);
  });

  it("contains the lockup inside a max box without stretching", async () => {
    const { containedLogoSize } = await import("@/lib/branding/logo-asset");
    expect(containedLogoSize(800, 800)).toEqual({ width: 800, height: 247 });
    expect(containedLogoSize(400, 80)).toEqual({ width: 259, height: 80 });
  });
});
