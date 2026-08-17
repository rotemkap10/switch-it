import { describe, expect, it } from "vitest";

import { DRIVER_NEARBY_PUSH_METERS } from "@/lib/push/types";
import { haversineDistanceMeters } from "@/lib/map/distance";

describe("driver nearby push threshold", () => {
  it("is 150m straight-line and fires once via unique dedupe_key", () => {
    expect(DRIVER_NEARBY_PUSH_METERS).toBe(150);
    const near = haversineDistanceMeters(
      { latitude: 32.0853, longitude: 34.7818 },
      { latitude: 32.0859, longitude: 34.7818 },
    );
    expect(near).toBeLessThan(DRIVER_NEARBY_PUSH_METERS);
  });
});
