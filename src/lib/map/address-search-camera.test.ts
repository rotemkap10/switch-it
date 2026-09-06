import { describe, expect, it } from "vitest";

import {
  isPreciseForwardGeocodeResult,
  zoomForForwardGeocodeResult,
} from "@/lib/map/address-search-camera";
import {
  MAP_ADDRESS_SEARCH_ZOOM,
  MAP_DEFAULT_ZOOM,
  MAP_SELECTED_SPOT_ZOOM,
} from "@/lib/map/seekerMapConfig";

describe("isPreciseForwardGeocodeResult", () => {
  it("treats house-number results as precise", () => {
    expect(isPreciseForwardGeocodeResult(["address"])).toBe(true);
    expect(isPreciseForwardGeocodeResult(["locality", "address"])).toBe(true);
  });

  it("treats street-level and broader results as imprecise", () => {
    expect(isPreciseForwardGeocodeResult(["road"])).toBe(false);
    expect(isPreciseForwardGeocodeResult(["street"])).toBe(false);
    expect(isPreciseForwardGeocodeResult(["locality"])).toBe(false);
    expect(isPreciseForwardGeocodeResult(["neighbourhood"])).toBe(false);
    expect(isPreciseForwardGeocodeResult(undefined)).toBe(false);
    expect(isPreciseForwardGeocodeResult([])).toBe(false);
  });
});

describe("zoomForForwardGeocodeResult", () => {
  it("uses street/building zoom for a precise address", () => {
    expect(zoomForForwardGeocodeResult(["address"])).toBe(MAP_ADDRESS_SEARCH_ZOOM);
    expect(MAP_ADDRESS_SEARCH_ZOOM).toBe(18);
  });

  it("keeps neighborhood zoom for a road without a house number", () => {
    expect(zoomForForwardGeocodeResult(["road"])).toBe(MAP_SELECTED_SPOT_ZOOM);
    expect(zoomForForwardGeocodeResult(["street"])).toBe(MAP_SELECTED_SPOT_ZOOM);
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
