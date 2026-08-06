import { describe, expect, it, beforeEach } from "vitest";

import {
  CORE_MODE_ROUTES,
  markRoutePrefetched,
  resetRoutePrefetchState,
  shouldDeferRoutePrefetch,
  shouldPrefetchRoute,
} from "@/lib/navigation/core-route-prefetch";

describe("core-route-prefetch", () => {
  beforeEach(() => {
    resetRoutePrefetchState();
  });

  it("lists both primary mode routes", () => {
    expect(CORE_MODE_ROUTES).toEqual(["/map", "/spots/new"]);
  });

  it("defers prefetch until authenticated shell is ready", () => {
    expect(shouldDeferRoutePrefetch({ ready: false })).toBe(true);
    expect(shouldDeferRoutePrefetch({ ready: true })).toBe(false);
  });

  it("defers prefetch when Save-Data is enabled", () => {
    expect(
      shouldDeferRoutePrefetch({ ready: true, saveData: true }),
    ).toBe(true);
  });

  it("prefetches each route at most once", () => {
    expect(shouldPrefetchRoute("/map")).toBe(true);
    markRoutePrefetched("/map");
    expect(shouldPrefetchRoute("/map")).toBe(false);
    expect(shouldPrefetchRoute("/spots/new")).toBe(true);
  });
});
