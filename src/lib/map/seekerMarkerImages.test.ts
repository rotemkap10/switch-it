import { describe, expect, it, vi } from "vitest";

import {
  SEEKER_MARKER_IMAGE_ID_LIST,
  SEEKER_MARKER_IMAGE_IDS,
  SPOTS_ICON_IMAGE_EXPRESSION,
  createSeekerMarkerImageData,
  registerSeekerMarkerImages,
} from "@/lib/map/seekerMarkerImages";

describe("seekerMarkerImages", () => {
  it("uses only the three stable image IDs", () => {
    expect(SEEKER_MARKER_IMAGE_ID_LIST).toEqual([
      "spot-unselected",
      "spot-selected",
      "spot-destination",
    ]);
  });

  it("builds non-empty ImageData for each marker", () => {
    for (const id of SEEKER_MARKER_IMAGE_ID_LIST) {
      const image = createSeekerMarkerImageData(id);
      expect(image.width).toBeGreaterThan(0);
      expect(image.height).toBeGreaterThan(0);
      expect(image.data.some((v) => v !== 0)).toBe(true);
    }
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

    expect(addImage).toHaveBeenCalledTimes(2);
    expect(addImage.mock.calls.map((c) => c[0]).sort()).toEqual([
      "spot-destination",
      "spot-selected",
    ]);
    for (const id of SEEKER_MARKER_IMAGE_ID_LIST) {
      expect(map.hasImage(id)).toBe(true);
    }
  });
});
