import { describe, expect, it, vi } from "vitest";

import {
  SEEKER_MARKER_IMAGE_ID_LIST,
  SEEKER_MARKER_IMAGE_IDS,
  SPOTS_ICON_IMAGE_EXPRESSION,
  createSeekerMarkerImageData,
  registerSeekerMarkerImages,
} from "@/lib/map/seekerMarkerImages";

describe("seekerMarkerImages", () => {
  it("uses only the stable vehicle marker image IDs", () => {
    expect(SEEKER_MARKER_IMAGE_ID_LIST).toEqual([
      "spot-unselected",
      "spot-selected",
      "spot-destination",
      "seeker-live",
    ]);
  });

  it("sizes live seeker markers distinctly from parking spots", () => {
    expect(createSeekerMarkerImageData("spot-unselected").width).toBe(52);
    expect(createSeekerMarkerImageData("spot-selected").width).toBe(62);
    const live = createSeekerMarkerImageData("seeker-live");
    const pin = createSeekerMarkerImageData("spot-destination");
    expect(live.width).toBe(52);
    expect(live.height).toBe(52);
    expect(pin.width).toBe(56);
    expect(pin.height).toBe(72);
  });

  it("uses a parking P mark instead of a vehicle glyph", () => {
    const unselected = createSeekerMarkerImageData("spot-unselected");
    const size = unselected.width;
    const cx = Math.round((size - 1) / 2);
    const cy = Math.round((size - 1) / 2);
    const center = (cy * size + cx) * 4;
    // Inner disc/P uses the cyan glyph, not a car-shaped block at center-right wheels.
    expect(unselected.data[center]).toBe(255);
    expect(unselected.data[center + 1]).toBe(255);
    expect(unselected.data[center + 2]).toBe(255);

    const stemX = Math.round(size * 0.4);
    const stemY = Math.round(size * 0.5);
    const stem = (stemY * size + stemX) * 4;
    expect(unselected.data[stem]).toBe(37);
    expect(unselected.data[stem + 1]).toBe(168);
    expect(unselected.data[stem + 2]).toBe(230);
  });

  it("keeps the live seeker marker as a small car, not a parking P", () => {
    const live = createSeekerMarkerImageData("seeker-live");
    const parking = createSeekerMarkerImageData("spot-destination");
    const liveSize = live.width;
    const liveCx = Math.round((liveSize - 1) / 2);
    const liveCy = Math.round((liveSize - 1) / 2);
    const cabin = (liveCy * liveSize + liveCx) * 4;
    expect(live.data[cabin]).toBe(230);
    expect(live.data[cabin + 1]).toBe(244);
    expect(live.data[cabin + 2]).toBe(255);

    const wheelX = Math.round(liveSize * 0.25);
    const wheelY = Math.round(liveSize * 0.36);
    const wheel = (wheelY * liveSize + wheelX) * 4;
    expect(live.data[wheel]).toBe(30);
    expect(live.data[wheel + 1]).toBe(42);
    expect(live.data[wheel + 2]).toBe(58);

    const pinHeadX = Math.round((parking.width - 1) / 2);
    const pinHeadY = Math.round(parking.height * 0.38);
    const pinHead = (pinHeadY * parking.width + pinHeadX) * 4;
    expect(parking.data[pinHead + 1]).toBeGreaterThan(140);
    expect(parking.data[pinHead]).not.toBe(live.data[cabin]);
  });

  it("draws the destination as a green parking pin, not a circular disc", () => {
    const pin = createSeekerMarkerImageData("spot-destination");
    const cx = Math.round((pin.width - 1) / 2);
    const tipY = pin.height - 4;
    const tip = (tipY * pin.width + cx) * 4;
    expect(pin.data[tip + 3]).toBeGreaterThan(0);
    expect(pin.data[tip + 1]).toBeGreaterThan(90);

    const aboveTipEmptyY = 2;
    const above = (aboveTipEmptyY * pin.width + cx) * 4;
    expect(pin.data[above + 3] ?? 0).toBeLessThan(40);

    const live = createSeekerMarkerImageData("seeker-live");
    expect(pin.height).toBeGreaterThan(live.height);
  });

  it("never uses an empty icon-image fallback in the spots expression", () => {
    expect(SPOTS_ICON_IMAGE_EXPRESSION).toEqual([
      "case",
      ["boolean", ["get", "selected"], false],
      SEEKER_MARKER_IMAGE_IDS.selected,
      SEEKER_MARKER_IMAGE_IDS.unselected,
    ]);
    for (const part of SPOTS_ICON_IMAGE_EXPRESSION) {
      if (typeof part === "string") {
        expect(part.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("registers missing images and skips ones already present", () => {
    const images = new Set<string>([SEEKER_MARKER_IMAGE_IDS.unselected]);
    const addImage = vi.fn((id: string) => {
      images.add(id);
    });
    const map = {
      hasImage: (id: string) => images.has(id),
      addImage,
    };

    registerSeekerMarkerImages(map as never);

    expect(addImage).toHaveBeenCalledTimes(3);
    expect(addImage.mock.calls.map((c) => c[0]).sort()).toEqual([
      "seeker-live",
      "spot-destination",
      "spot-selected",
    ]);
    for (const id of SEEKER_MARKER_IMAGE_ID_LIST) {
      expect(map.hasImage(id)).toBe(true);
    }
  });
});
