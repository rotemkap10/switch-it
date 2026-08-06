import { describe, expect, it } from "vitest";

import {
  readSessionMapCamera,
  resetSessionMapCameras,
  writeSessionMapCamera,
} from "@/lib/map/session-camera";

describe("session-camera", () => {
  it("keeps seeker and publisher cameras separate in memory", () => {
    resetSessionMapCameras();

    writeSessionMapCamera("seeker", {
      center: [34.8, 32.1],
      zoom: 14,
    });
    writeSessionMapCamera("publisher", {
      center: [34.9, 32.2],
      zoom: 16,
    });

    expect(readSessionMapCamera("seeker")).toEqual({
      center: [34.8, 32.1],
      zoom: 14,
    });
    expect(readSessionMapCamera("publisher")).toEqual({
      center: [34.9, 32.2],
      zoom: 16,
    });
  });

  it("ignores non-finite camera values", () => {
    resetSessionMapCameras();
    writeSessionMapCamera("seeker", {
      center: [Number.NaN, 32],
      zoom: 14,
    });
    expect(readSessionMapCamera("seeker")).toBeNull();
  });
});
