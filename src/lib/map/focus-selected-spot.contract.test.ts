import { describe, expect, it, vi } from "vitest";

/**
 * Documents the interaction contract used by ParkingMapMapLibre:
 * callers skip focusSelectedSpot when the same spot id is re-selected.
 */
describe("selected spot focus contract", () => {
  it("skips redundant camera movement for the same spot id", () => {
    const easeTo = vi.fn();
    const map = { easeTo, getZoom: () => 14 };
    let lastFocused: string | null = null;

    function focusIfNeeded(id: string) {
      if (lastFocused === id) {
        return;
      }
      lastFocused = id;
      map.easeTo({
        center: [34.78, 32.08],
        duration: 0,
        essential: true,
      });
    }

    focusIfNeeded("spot-1");
    focusIfNeeded("spot-1");
    focusIfNeeded("spot-2");

    expect(easeTo).toHaveBeenCalledTimes(2);
  });
});
