import { describe, expect, it } from "vitest";

import {
  MAP_CAROUSEL_CLASS,
  MAP_FLOATING_CONTROL_CLASS,
  MAP_SHEET_CLASS,
  MAP_SHEET_HOST_CLASS,
  resolveDiscoveryBottomStack,
  syncDocumentMapBottomStack,
} from "@/lib/map/bottom-stack";

describe("map bottom-stack contract", () => {
  it("resolves discovery priority: selected > carousel > none", () => {
    expect(
      resolveDiscoveryBottomStack({ hasSpots: false, hasSelected: false }),
    ).toBe("none");
    expect(
      resolveDiscoveryBottomStack({ hasSpots: true, hasSelected: false }),
    ).toBe("carousel");
    expect(
      resolveDiscoveryBottomStack({ hasSpots: true, hasSelected: true }),
    ).toBe("selected");
    expect(
      resolveDiscoveryBottomStack({ hasSpots: false, hasSelected: true }),
    ).toBe("selected");
  });

  it("exposes shared class names for layout CSS", () => {
    expect(MAP_FLOATING_CONTROL_CLASS).toBe("map-floating-control");
    expect(MAP_CAROUSEL_CLASS).toBe("map-carousel");
    expect(MAP_SHEET_CLASS).toBe("map-bottom-sheet");
    expect(MAP_SHEET_HOST_CLASS).toBe("map-bottom-sheet-host");
  });

  it("syncs document data-map-bottom for toast clearance", () => {
    syncDocumentMapBottomStack("carousel");
    expect(document.documentElement.dataset.mapBottom).toBe("carousel");
    syncDocumentMapBottomStack("none");
    expect(document.documentElement.dataset.mapBottom).toBeUndefined();
    syncDocumentMapBottomStack("claim-expanded");
    expect(document.documentElement.dataset.mapBottom).toBe("claim-expanded");
    syncDocumentMapBottomStack("compose");
    expect(document.documentElement.dataset.mapBottom).toBe("compose");
    syncDocumentMapBottomStack(null);
    expect(document.documentElement.dataset.mapBottom).toBeUndefined();
  });
});
