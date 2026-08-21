import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAP_DRAG_PAN_INERTIA_OPTIONS,
  MAP_INTERACTION_OPTIONS,
  isMapCameraBusy,
  resolveMapReduceMotion,
} from "@/lib/map/maplibre-interaction";

describe("maplibre interaction config", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports a single BaseMap constructor interaction profile", () => {
    expect(MAP_DRAG_PAN_INERTIA_OPTIONS).toEqual({
      linearity: 0.3,
      deceleration: 2500,
      maxSpeed: 1400,
    });
    expect(MAP_INTERACTION_OPTIONS).toEqual({
      dragPan: MAP_DRAG_PAN_INERTIA_OPTIONS,
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

  it("reads prefers-reduced-motion for MapLibre reduceMotion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }));
    expect(resolveMapReduceMotion()).toBe(true);
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }));
    expect(resolveMapReduceMotion()).toBe(false);
  });

  it("does not expose a picker-specific dragPan.enable helper", async () => {
    const mod = await import("@/lib/map/maplibre-interaction");
    expect("applyMapInteractionMode" in mod).toBe(false);
    expect(vi).toBeTruthy();
  });
});
