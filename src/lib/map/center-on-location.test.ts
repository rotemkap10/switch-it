import { describe, expect, it, vi } from "vitest";

import { centerMapOnLocation } from "@/lib/map/center-on-location";
import {
  MAP_DEFAULT_ZOOM,
  MAP_SELECTED_SPOT_ZOOM,
} from "@/lib/map/seekerMapConfig";

describe("centerMapOnLocation", () => {
  it("preserves zoom when already at street level", () => {
    const easeTo = vi.fn();
    const map = { easeTo, getZoom: () => 15 };

    centerMapOnLocation(map, 34.78, 32.08);

    expect(easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [34.78, 32.08],
        zoom: 15,
        duration: 450,
      }),
    );
  });

  it("uses fallback zoom when zoomed out", () => {
    const easeTo = vi.fn();
    const map = { easeTo, getZoom: () => 10 };

    centerMapOnLocation(map, 34.78, 32.08);

    expect(easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        zoom: MAP_DEFAULT_ZOOM,
      }),
    );
  });

  it("applies minStreetZoom for the publisher picker", () => {
    const easeTo = vi.fn();
    const map = { easeTo, getZoom: () => 14 };

    centerMapOnLocation(map, 34.78, 32.08, { minStreetZoom: true });

    expect(easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        zoom: MAP_SELECTED_SPOT_ZOOM,
      }),
    );
  });

  it("uses zero duration when reduced motion is enabled", () => {
    const easeTo = vi.fn();
    const map = { easeTo, getZoom: () => 15 };

    centerMapOnLocation(map, 34.78, 32.08, { reducedMotion: true });

    expect(easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 0 }),
    );
  });
});
