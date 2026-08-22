import { describe, expect, it } from "vitest";

import { isMapUsable } from "@/lib/map/map-instance-guards";

describe("isMapUsable", () => {
  it("returns false for null or removed maps", () => {
    expect(isMapUsable(null)).toBe(false);
    expect(
      isMapUsable({
        _removed: true,
        getCanvas: () => document.createElement("canvas"),
        isStyleLoaded: () => true,
      } as never),
    ).toBe(false);
  });

  it("returns false when canvas is detached", () => {
    const canvas = document.createElement("canvas");
    expect(
      isMapUsable({
        getCanvas: () => canvas,
        isStyleLoaded: () => true,
      } as never),
    ).toBe(false);
  });

  it("returns false when style is not loaded", () => {
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    expect(
      isMapUsable({
        getCanvas: () => canvas,
        isStyleLoaded: () => false,
      } as never),
    ).toBe(false);
    canvas.remove();
  });

  it("returns true for an attached map with loaded style", () => {
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    expect(
      isMapUsable({
        getCanvas: () => canvas,
        isStyleLoaded: () => true,
      } as never),
    ).toBe(true);
    canvas.remove();
  });

  it("returns false when getCanvas throws", () => {
    expect(
      isMapUsable({
        getCanvas: () => {
          throw new Error("destroyed");
        },
        isStyleLoaded: () => true,
      } as never),
    ).toBe(false);
  });
});
