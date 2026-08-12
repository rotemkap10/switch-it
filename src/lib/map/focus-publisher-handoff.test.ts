import { describe, expect, it, vi } from "vitest";

import {
  focusPublisherHandoffCamera,
  publisherHandoffFitBounds,
} from "@/lib/map/focus-publisher-handoff";
import { MAP_SELECTED_SPOT_ZOOM } from "@/lib/map/seekerMapConfig";

const parking = { longitude: 34.7818, latitude: 32.0853 };
const seeker = { longitude: 34.782, latitude: 32.086 };

describe("publisherHandoffFitBounds", () => {
  it("uses MapLibre [longitude, latitude] corners", () => {
    expect(publisherHandoffFitBounds(parking, seeker)).toEqual([
      [34.7818, 32.0853],
      [34.782, 32.086],
    ]);
  });

  it("does not treat latitude as longitude", () => {
    const bounds = publisherHandoffFitBounds(parking, seeker);
    expect(bounds[0][0]).toBeCloseTo(34.7818);
    expect(bounds[0][1]).toBeCloseTo(32.0853);
    expect(Math.abs(bounds[0][0])).toBeGreaterThan(30);
    expect(Math.abs(bounds[0][1])).toBeLessThan(35);
  });
});

describe("focusPublisherHandoffCamera", () => {
  it("centers on the parking spot when no seeker point exists", () => {
    const map = { resize: vi.fn(), fitBounds: vi.fn(), easeTo: vi.fn() };

    focusPublisherHandoffCamera(map, parking, null);

    expect(map.resize).toHaveBeenCalledTimes(1);
    expect(map.easeTo).toHaveBeenCalledWith({
      center: [34.7818, 32.0853],
      zoom: MAP_SELECTED_SPOT_ZOOM,
      duration: 400,
      essential: true,
    });
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it("fits parking spot and seeker together", () => {
    const map = { resize: vi.fn(), fitBounds: vi.fn(), easeTo: vi.fn() };

    focusPublisherHandoffCamera(map, parking, seeker);

    expect(map.fitBounds).toHaveBeenCalledWith(
      [
        [34.7818, 32.0853],
        [34.782, 32.086],
      ],
      expect.objectContaining({ padding: 48, maxZoom: MAP_SELECTED_SPOT_ZOOM }),
    );
    expect(map.easeTo).not.toHaveBeenCalled();
  });

  it("uses last-known seeker coordinates when paused or delayed", () => {
    const map = { resize: vi.fn(), fitBounds: vi.fn(), easeTo: vi.fn() };
    const lastKnown = { longitude: 34.79, latitude: 32.09 };

    focusPublisherHandoffCamera(map, parking, lastKnown);

    expect(map.fitBounds.mock.calls[0]?.[0]).toEqual([
      [34.7818, 32.0853],
      [34.79, 32.09],
    ]);
  });
});
