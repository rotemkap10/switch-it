import { describe, expect, it, vi } from "vitest";

import {
  focusPublisherHandoffCamera,
  keepPublisherHandoffInView,
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

  it("uses easeTo instead of fitBounds when parking and seeker are the same point", () => {
    const map = { resize: vi.fn(), fitBounds: vi.fn(), easeTo: vi.fn() };
    const same = { longitude: 34.7818, latitude: 32.0853 };

    focusPublisherHandoffCamera(map, parking, same);

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

  it("refits when a live point leaves the current viewport while follow is on", () => {
    const map = {
      resize: vi.fn(),
      fitBounds: vi.fn(),
      easeTo: vi.fn(),
      getZoom: vi.fn(() => 15),
      getBounds: vi.fn(() => ({
        contains: (lngLat: [number, number]) => lngLat[0] < 34.79,
      })),
    };

    keepPublisherHandoffInView(map, parking, { longitude: 34.8, latitude: 32.09 });

    expect(map.fitBounds).toHaveBeenCalled();
  });

  it("does not reset zoom when parking and seeker are already visible", () => {
    const map = {
      resize: vi.fn(),
      fitBounds: vi.fn(),
      easeTo: vi.fn(),
      getZoom: vi.fn(() => 15),
      getBounds: vi.fn(() => ({
        contains: () => true,
      })),
    };

    keepPublisherHandoffInView(map, parking, seeker);

    expect(map.fitBounds).not.toHaveBeenCalled();
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
