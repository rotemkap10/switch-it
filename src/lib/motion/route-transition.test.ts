import { describe, expect, it } from "vitest";

import {
  ROUTE_TRANSITION_MIN_VISIBLE_MS,
  ROUTE_TRANSITION_REVEAL_DELAY_MS,
  ROUTE_TRANSITION_SAFETY_TIMEOUT_MS,
  isModifiedClick,
  isMapModeHomePath,
  resolveRouteLoadingKind,
  shouldSkipMapModeRouteOverlay,
  shouldSkipRouteTransitionOverlay,
  shouldStartRouteTransition,
} from "@/lib/motion/route-transition";

describe("route-transition helpers", () => {
  it("centralizes anti-flicker timings in the recommended bands", () => {
    expect(ROUTE_TRANSITION_REVEAL_DELAY_MS).toBeGreaterThanOrEqual(120);
    expect(ROUTE_TRANSITION_REVEAL_DELAY_MS).toBeLessThanOrEqual(180);
    expect(ROUTE_TRANSITION_MIN_VISIBLE_MS).toBeGreaterThanOrEqual(250);
    expect(ROUTE_TRANSITION_MIN_VISIBLE_MS).toBeLessThanOrEqual(350);
    expect(ROUTE_TRANSITION_SAFETY_TIMEOUT_MS).toBeGreaterThan(
      ROUTE_TRANSITION_MIN_VISIBLE_MS,
    );
  });

  it("detects modified clicks", () => {
    expect(isModifiedClick({ metaKey: true })).toBe(true);
    expect(isModifiedClick({ ctrlKey: true })).toBe(true);
    expect(isModifiedClick({ shiftKey: true })).toBe(true);
    expect(isModifiedClick({ altKey: true })).toBe(true);
    expect(isModifiedClick({ button: 1 })).toBe(true);
    expect(isModifiedClick({ button: 0 })).toBe(false);
  });

  it("allows internal path changes", () => {
    expect(
      shouldStartRouteTransition({
        href: "/profile",
        currentPathname: "/map",
        currentSearch: "",
      }),
    ).toBe(true);
  });

  it("skips current-route clicks", () => {
    expect(
      shouldStartRouteTransition({
        href: "/profile",
        currentPathname: "/profile",
        currentSearch: "",
      }),
    ).toBe(false);
  });

  it("skips hash-only navigation", () => {
    expect(
      shouldStartRouteTransition({
        href: "#section",
        currentPathname: "/map",
        currentSearch: "",
      }),
    ).toBe(false);
    expect(
      shouldStartRouteTransition({
        href: "/map#pins",
        currentPathname: "/map",
        currentSearch: "",
      }),
    ).toBe(false);
  });

  it("skips external, mailto, tel, download, new-tab, and modified clicks", () => {
    expect(
      shouldStartRouteTransition({
        href: "https://example.com/x",
        currentPathname: "/map",
        currentSearch: "",
      }),
    ).toBe(false);
    expect(
      shouldStartRouteTransition({
        href: "mailto:a@b.com",
        currentPathname: "/map",
        currentSearch: "",
      }),
    ).toBe(false);
    expect(
      shouldStartRouteTransition({
        href: "tel:+15551212",
        currentPathname: "/map",
        currentSearch: "",
      }),
    ).toBe(false);
    expect(
      shouldStartRouteTransition({
        href: "/profile",
        currentPathname: "/map",
        currentSearch: "",
        download: true,
      }),
    ).toBe(false);
    expect(
      shouldStartRouteTransition({
        href: "/profile",
        currentPathname: "/map",
        currentSearch: "",
        target: "_blank",
      }),
    ).toBe(false);
    expect(
      shouldStartRouteTransition({
        href: "/profile",
        currentPathname: "/map",
        currentSearch: "",
        modifiedClick: true,
      }),
    ).toBe(false);
  });

  it("identifies map-mode homes for overlay skip", () => {
    expect(isMapModeHomePath("/map")).toBe(true);
    expect(isMapModeHomePath("/spots/new")).toBe(true);
    expect(isMapModeHomePath("/profile")).toBe(false);
    expect(shouldSkipMapModeRouteOverlay("/map", "/spots/new")).toBe(true);
    expect(shouldSkipMapModeRouteOverlay("/spots/new", "/map")).toBe(true);
    expect(shouldSkipMapModeRouteOverlay("/map", "/profile")).toBe(false);
  });

  it("classifies destination loading shells and skips competing overlays", () => {
    expect(resolveRouteLoadingKind("/map")).toBe("map-seeker");
    expect(resolveRouteLoadingKind("/spots/new")).toBe("map-publisher");
    expect(resolveRouteLoadingKind("/profile")).toBe("page");
    expect(resolveRouteLoadingKind("/history")).toBe("page");
    expect(resolveRouteLoadingKind("/help")).toBe("page");
    expect(resolveRouteLoadingKind("/login")).toBe("auth");
    expect(resolveRouteLoadingKind("/onboarding/vehicle")).toBe("auth");
    expect(resolveRouteLoadingKind("/offline")).toBe("none");

    expect(shouldSkipRouteTransitionOverlay("/map")).toBe(true);
    expect(shouldSkipRouteTransitionOverlay("/spots/new")).toBe(true);
    expect(shouldSkipRouteTransitionOverlay("/profile")).toBe(true);
    expect(shouldSkipRouteTransitionOverlay("/help")).toBe(true);
    expect(shouldSkipRouteTransitionOverlay("/login")).toBe(true);
    expect(shouldSkipRouteTransitionOverlay("/offline")).toBe(false);
  });
});
