import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  launchIconCssPx,
  SWITCH_IT_LAUNCH_ICON_HEIGHT,
  SWITCH_IT_LAUNCH_ICON_RATIO,
  SWITCH_IT_LAUNCH_ICON_SRC,
  SWITCH_IT_LAUNCH_ICON_WIDTH,
  containedLogoSize,
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
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(png[25]).toBe(6);
  });

  it("ships a square launch icon tile with no wordmark", () => {
    expect(SWITCH_IT_LAUNCH_ICON_SRC).toBe("/branding/switch-it-launch-icon.png");
    expect(SWITCH_IT_LAUNCH_ICON_WIDTH).toBe(SWITCH_IT_LAUNCH_ICON_HEIGHT);
    expect(SWITCH_IT_LAUNCH_ICON_RATIO).toBe(0.3);

    const launchPng = readFileSync(
      resolve(process.cwd(), "public/branding/switch-it-launch-icon.png"),
    );
    expect(launchPng.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(launchPng[25]).toBe(6);
    expect(launchPng.length).toBeLessThan(250_000);
  });

  it("sizes the launch icon at ~30% of the shorter viewport side", () => {
    expect(launchIconCssPx(390, 844)).toBe(117);
    expect(launchIconCssPx(852, 393)).toBe(118);
  });

  it("contains the lockup inside a max box without stretching", () => {
    expect(containedLogoSize(800, 800)).toEqual({ width: 800, height: 247 });
    expect(containedLogoSize(400, 80)).toEqual({ width: 259, height: 80 });
  });
});
