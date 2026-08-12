import { describe, expect, it, vi } from "vitest";

import {
  MAP_INTERACTION_OPTIONS,
  isMapCameraBusy,
} from "@/lib/map/maplibre-interaction";

describe("maplibre interaction config", () => {
  it("exports a single BaseMap constructor interaction profile", () => {
    expect(MAP_INTERACTION_OPTIONS).toEqual({
      dragPan: {
        linearity: 0.3,
        deceleration: 2500,
        maxSpeed: 1400,
      },
      dragRotate: false,
      touchPitch: false,
      pitchWithRotate: false,
      maxPitch: 0,
    });
  });

  it("treats isMoving or isEasing as a busy camera", () => {
    expect(
      isMapCameraBusy({
        isMoving: () => true,
        isEasing: () => false,
      } as never),
    ).toBe(true);
    expect(
      isMapCameraBusy({
        isMoving: () => false,
        isEasing: () => true,
      } as never),
    ).toBe(true);
    expect(
      isMapCameraBusy({
        isMoving: () => false,
        isEasing: () => false,
      } as never),
    ).toBe(false);
  });

  it("does not expose a picker-specific dragPan.enable helper", async () => {
    const mod = await import("@/lib/map/maplibre-interaction");
    expect("applyMapInteractionMode" in mod).toBe(false);
    expect("MAP_DRAG_PAN_INERTIA_OPTIONS" in mod).toBe(false);
    expect(vi).toBeTruthy();
  });
});
