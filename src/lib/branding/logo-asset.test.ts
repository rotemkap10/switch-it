import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  containedLogoSize,
  SWITCH_IT_LAUNCH_LOGO_HEIGHT,
  SWITCH_IT_LAUNCH_LOGO_SRC,
  SWITCH_IT_LAUNCH_LOGO_WIDTH,
  SWITCH_IT_LOGO_HEIGHT,
  SWITCH_IT_LOGO_WIDTH,
} from "@/lib/branding/logo-asset";

describe("official logo asset", () => {
  it("is a transparent horizontal lockup, not a square canvas", () => {
    expect(SWITCH_IT_LOGO_WIDTH).toBe(1106);
    expect(SWITCH_IT_LOGO_HEIGHT).toBe(342);
    expect(SWITCH_IT_LOGO_WIDTH / SWITCH_IT_LOGO_HEIGHT).toBeCloseTo(3.23, 1);

    const png = readFileSync(
      resolve(process.cwd(), "public/branding/switch-it-logo.png"),
    );
    // PNG IHDR color type at byte 25: 6 = RGBA
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(png[25]).toBe(6);
  });

  it("ships a smaller launch lockup with the same aspect ratio", () => {
    expect(SWITCH_IT_LAUNCH_LOGO_SRC).toBe("/branding/switch-it-logo-launch.png");
    expect(SWITCH_IT_LAUNCH_LOGO_WIDTH / SWITCH_IT_LAUNCH_LOGO_HEIGHT).toBeCloseTo(
      SWITCH_IT_LOGO_WIDTH / SWITCH_IT_LOGO_HEIGHT,
      2,
    );

    const launchPng = readFileSync(
      resolve(process.cwd(), "public/branding/switch-it-logo-launch.png"),
    );
    expect(launchPng.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(launchPng[25]).toBe(6);
    expect(launchPng.length).toBeLessThan(200_000);
  });

  it("contains the lockup inside a max box without stretching", () => {
    expect(containedLogoSize(800, 800)).toEqual({ width: 800, height: 247 });
    expect(containedLogoSize(400, 80)).toEqual({ width: 259, height: 80 });
  });
});
