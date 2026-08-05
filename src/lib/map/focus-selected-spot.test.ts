import { describe, expect, it, vi } from "vitest";

import { focusSelectedSpot } from "@/lib/map/focus-selected-spot";

describe("focusSelectedSpot", () => {
  it("eases to the spot with a bottom overlay offset", () => {
    const easeTo = vi.fn();
    const map = {
      easeTo,
      getZoom: () => 14,
    };

    focusSelectedSpot(map, {
      longitude: 34.78,
      latitude: 32.08,
      offsetY: -112,
      durationMs: 500,
    });

    expect(easeTo).toHaveBeenCalledTimes(1);
    expect(easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [34.78, 32.08],
        offset: [0, -112],
        duration: 500,
        essential: true,
        zoom: 14,
      }),
    );
  });

  it("does not jump above the selected-spot zoom ceiling", () => {
    const easeTo = vi.fn();
    focusSelectedSpot(
      {
        easeTo,
        getZoom: () => 17,
      },
      {
        longitude: 34.78,
        latitude: 32.08,
        durationMs: 0,
      },
    );

    expect(easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        zoom: 16,
      }),
    );
  });
});
