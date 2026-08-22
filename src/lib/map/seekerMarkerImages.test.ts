import { describe, expect, it, vi } from "vitest";

import {
  SEEKER_MARKER_IMAGE_ID_LIST,
  SEEKER_MARKER_IMAGE_IDS,
  SPOTS_ICON_IMAGE_EXPRESSION,
  createSeekerMarkerImageData,
  registerSeekerMarkerImages,
} from "@/lib/map/seekerMarkerImages";

describe("seekerMarkerImages", () => {
  function pixelAt(
    image: { width: number; data: Uint8ClampedArray },
    x: number,
    y: number,
  ): [number, number, number, number] {
    const i = (y * image.width + x) * 4;
    return [
      image.data[i] ?? 0,
      image.data[i + 1] ?? 0,
      image.data[i + 2] ?? 0,
      image.data[i + 3] ?? 0,
    ];
  }

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
    expect(live.width).toBe(112);
    expect(live.height).toBe(136);
    expect(pin.width).toBe(104);
    expect(pin.height).toBe(144);
    expect(pin.height).toBeGreaterThan(live.width);
  });

  it("uses a parking P mark instead of a vehicle glyph", () => {
    const unselected = createSeekerMarkerImageData("spot-unselected");
    const size = unselected.width;
    const cx = Math.round((size - 1) / 2);
    const cy = Math.round((size - 1) / 2);
    const center = (cy * size + cx) * 4;
    expect(unselected.data[center]).toBe(248);
    expect(unselected.data[center + 1]).toBe(247);
    expect(unselected.data[center + 2]).toBe(244);

    const stemX = Math.round(size * 0.4);
    const stemY = Math.round(size * 0.5);
    const stem = (stemY * size + stemX) * 4;
    expect(unselected.data[stem]).toBe(0);
    expect(unselected.data[stem + 1]).toBe(87);
    expect(unselected.data[stem + 2]).toBe(255);
  });

  it("keeps the live seeker marker as a sedan, not a parking P", () => {
    const live = createSeekerMarkerImageData("seeker-live");
    const parking = createSeekerMarkerImageData("spot-destination");

    const windshield = pixelAt(live, 56, 44);
    expect(windshield[0]).toBe(248);
    expect(windshield[1]).toBe(247);
    expect(windshield[2]).toBe(244);

    const wheel = pixelAt(live, 36, 52);
    expect(wheel[0]).toBe(0);
    expect(wheel[1]).toBe(87);
    expect(wheel[2]).toBe(255);
    expect(wheel[3]).toBeGreaterThan(200);

    const body = pixelAt(live, 56, 24);
    const bodyIsBlue = body[0] === 0 && body[1] === 87 && body[2] === 255;
    const bodyIsPorcelain =
      body[0] === 248 && body[1] === 247 && body[2] === 244;
    expect(bodyIsBlue || bodyIsPorcelain).toBe(true);

    const pinFill = pixelAt(parking, 24, 52);
    expect(pinFill[2]).toBe(255);
    expect(pinFill[0]).toBe(0);
    expect(pinFill[1]).toBe(87);
    expect(live.width).not.toBe(parking.width);
  });

  it("draws the destination as a blue parking pin, not a circular disc", () => {
    const pin = createSeekerMarkerImageData("spot-destination");
    const cx = Math.round((pin.width - 1) / 2);
    const tip = pixelAt(pin, cx, pin.height - 8);
    expect(tip[3]).toBeGreaterThan(0);
    expect(tip[2]).toBeGreaterThan(tip[1]);
    expect(tip[0]).toBeLessThan(80);

    const above = pixelAt(pin, cx, 2);
    expect(above[3]).toBeLessThan(40);

    const corner = pixelAt(pin, 2, 2);
    expect(corner[3]).toBeLessThan(40);

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
    expect(addImage).toHaveBeenCalledWith(
      "seeker-live",
      expect.anything(),
      expect.objectContaining({ pixelRatio: 3, sdf: false }),
    );
    expect(addImage).toHaveBeenCalledWith(
      "spot-destination",
      expect.anything(),
      expect.objectContaining({ pixelRatio: 3, sdf: false }),
    );
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
