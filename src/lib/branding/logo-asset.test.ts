import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("official logo asset", () => {
  it("is a transparent horizontal lockup, not a square canvas", async () => {
    const {
      SWITCH_IT_LOGO_WIDTH,
      SWITCH_IT_LOGO_HEIGHT,
    } = await import("@/lib/branding/logo-asset");

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

  it("ships a transparent standalone launch mark with no app-icon tile", async () => {
    const {
      SWITCH_IT_LAUNCH_MARK_SRC,
      SWITCH_IT_LAUNCH_MARK_WIDTH,
      SWITCH_IT_LAUNCH_MARK_HEIGHT,
      SWITCH_IT_LAUNCH_MARK_RATIO,
      launchMarkCssPx,
    } = await import("@/lib/branding/logo-asset");

    expect(SWITCH_IT_LAUNCH_MARK_SRC).toBe("/branding/switch-it-launch-mark.png");
    expect(SWITCH_IT_LAUNCH_MARK_HEIGHT).toBeGreaterThan(SWITCH_IT_LAUNCH_MARK_WIDTH);
    expect(SWITCH_IT_LAUNCH_MARK_RATIO).toBe(0.28);

    const launchPng = readFileSync(
      resolve(process.cwd(), "public/branding/switch-it-launch-mark.png"),
    );
    expect(launchPng.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(launchPng[25]).toBe(6);

    const { data, info } = await import("sharp").then((sharp) =>
      sharp
        .default(launchPng)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
    );

    let transparent = 0;
    let symbol = 0;
    let tileCyan = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 20) {
        transparent += 1;
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

    expect(transparent).toBeGreaterThan(info.width * info.height * 0.15);
    expect(symbol).toBeGreaterThan(1000);
    expect(tileCyan).toBe(0);
    expect(launchMarkCssPx(390, 844)).toBe(109);
  });

  it("contains the lockup inside a max box without stretching", async () => {
    const { containedLogoSize } = await import("@/lib/branding/logo-asset");
    expect(containedLogoSize(800, 800)).toEqual({ width: 800, height: 247 });
    expect(containedLogoSize(400, 80)).toEqual({ width: 259, height: 80 });
  });
});
