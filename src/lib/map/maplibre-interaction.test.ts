import { describe, expect, it, vi } from "vitest";

import {
  MAP_DRAG_PAN_INERTIA_OPTIONS,
  MAP_INTERACTION_OPTIONS,
  applyMapInteractionMode,
} from "@/lib/map/maplibre-interaction";

describe("maplibre interaction config", () => {
  it("exports the MapLibre default pan-inertia profile for shared use", () => {
    expect(MAP_DRAG_PAN_INERTIA_OPTIONS).toEqual({
      linearity: 0.3,
      deceleration: 2500,
      maxSpeed: 1400,
    });
    expect(MAP_INTERACTION_OPTIONS.dragPan).toEqual(MAP_DRAG_PAN_INERTIA_OPTIONS);
    expect(MAP_INTERACTION_OPTIONS.dragRotate).toBe(false);
    expect(MAP_INTERACTION_OPTIONS.touchPitch).toBe(false);
  });

  it("enables touch pan and pinch zoom with explicit inertia options", () => {
    const map = {
      dragPan: { enable: vi.fn(), disable: vi.fn() },
      scrollZoom: { enable: vi.fn(), disable: vi.fn() },
      boxZoom: { enable: vi.fn(), disable: vi.fn() },
      doubleClickZoom: { enable: vi.fn(), disable: vi.fn() },
      touchZoomRotate: {
        enable: vi.fn(),
        disable: vi.fn(),
        disableRotation: vi.fn(),
      },
      keyboard: { enable: vi.fn(), disable: vi.fn() },
    };

    applyMapInteractionMode(map as never, { enabled: true });

    expect(map.dragPan.enable).toHaveBeenCalledWith({
      ...MAP_DRAG_PAN_INERTIA_OPTIONS,
    });
    expect(map.scrollZoom.enable).toHaveBeenCalled();
    expect(map.touchZoomRotate.enable).toHaveBeenCalled();
    expect(map.touchZoomRotate.disableRotation).toHaveBeenCalled();
  });

  it("disables pan/zoom when the picker is locked", () => {
    const map = {
      dragPan: { enable: vi.fn(), disable: vi.fn() },
      scrollZoom: { enable: vi.fn(), disable: vi.fn() },
      boxZoom: { enable: vi.fn(), disable: vi.fn() },
      doubleClickZoom: { enable: vi.fn(), disable: vi.fn() },
      touchZoomRotate: {
        enable: vi.fn(),
        disable: vi.fn(),
        disableRotation: vi.fn(),
      },
      keyboard: { enable: vi.fn(), disable: vi.fn() },
    };

    applyMapInteractionMode(map as never, { enabled: false });

    expect(map.dragPan.disable).toHaveBeenCalled();
    expect(map.scrollZoom.disable).toHaveBeenCalled();
    expect(map.touchZoomRotate.disable).toHaveBeenCalled();
  });
});
