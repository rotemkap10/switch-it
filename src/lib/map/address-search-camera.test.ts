import { describe, expect, it } from "vitest";

import { zoomForForwardGeocodeResult } from "@/lib/map/address-search-camera";
import {
  MAP_ADDRESS_SEARCH_ZOOM,
  MAP_DEFAULT_ZOOM,
  MAP_SELECTED_SPOT_ZOOM,
} from "@/lib/map/seekerMapConfig";

describe("zoomForForwardGeocodeResult", () => {
  it("uses street/building zoom for a precise address", () => {
    expect(zoomForForwardGeocodeResult(["address"])).toBe(MAP_ADDRESS_SEARCH_ZOOM);
    expect(MAP_ADDRESS_SEARCH_ZOOM).toBe(18);
  });

  it("keeps neighborhood zoom for a road without a house number", () => {
    expect(zoomForForwardGeocodeResult(["road"])).toBe(MAP_SELECTED_SPOT_ZOOM);
  });

  it("keeps the city-scale zoom for a broad locality", () => {
    expect(zoomForForwardGeocodeResult(["locality"])).toBe(MAP_DEFAULT_ZOOM);
    expect(zoomForForwardGeocodeResult(["place"])).toBe(MAP_DEFAULT_ZOOM);
  });

  it("prefers a precise address when mixed types are present", () => {
    expect(zoomForForwardGeocodeResult(["locality", "address"])).toBe(
      MAP_ADDRESS_SEARCH_ZOOM,
    );
  });

  it("defaults unknown results to the tighter parking zoom", () => {
    expect(zoomForForwardGeocodeResult(undefined)).toBe(MAP_ADDRESS_SEARCH_ZOOM);
    expect(zoomForForwardGeocodeResult([])).toBe(MAP_ADDRESS_SEARCH_ZOOM);
  });
});
