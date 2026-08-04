import { describe, expect, it } from "vitest";

import {
  buildAppleMapsDirectionsUrl,
  buildExternalNavigationLinks,
  buildGoogleMapsDirectionsUrl,
  buildWazeNavigateUrl,
  formatNavigationCoordinate,
  isValidNavigationCoords,
  shouldOfferAppleMaps,
} from "@/lib/map/navigation-urls";

describe("navigation-urls", () => {
  it("validates finite in-range coordinates", () => {
    expect(isValidNavigationCoords(32.0853, 34.7818)).toBe(true);
    expect(isValidNavigationCoords(-33.8688, 151.2093)).toBe(true);
    expect(isValidNavigationCoords(-90, -180)).toBe(true);
    expect(isValidNavigationCoords(90, 180)).toBe(true);
    expect(isValidNavigationCoords(91, 0)).toBe(false);
    expect(isValidNavigationCoords(0, 181)).toBe(false);
    expect(isValidNavigationCoords(Number.NaN, 34)).toBe(false);
    expect(isValidNavigationCoords(32, Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("formats coordinates consistently", () => {
    expect(formatNavigationCoordinate(32.0853124)).toBe("32.085312");
    expect(formatNavigationCoordinate(-34.7818)).toBe("-34.781800");
  });

  it("builds a Waze navigate URL for valid coordinates", () => {
    expect(buildWazeNavigateUrl(32.085312, 34.781812)).toBe(
      "https://waze.com/ul?ll=32.085312%2C34.781812&navigate=yes",
    );
  });

  it("builds a Google Maps directions URL for valid coordinates", () => {
    expect(buildGoogleMapsDirectionsUrl(32.085312, 34.781812)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=32.085312%2C34.781812",
    );
  });

  it("builds an Apple Maps directions URL for valid coordinates", () => {
    expect(buildAppleMapsDirectionsUrl(32.085312, -34.781812)).toBe(
      "https://maps.apple.com/?daddr=32.085312%2C-34.781812",
    );
  });

  it("returns null URL builders for invalid latitude or longitude", () => {
    expect(buildWazeNavigateUrl(91, 34)).toBeNull();
    expect(buildGoogleMapsDirectionsUrl(32, 200)).toBeNull();
    expect(buildAppleMapsDirectionsUrl(Number.NaN, 34)).toBeNull();
  });

  it("does not add accidental extra parameters", () => {
    const waze = buildWazeNavigateUrl(32.1, 34.8)!;
    const google = buildGoogleMapsDirectionsUrl(32.1, 34.8)!;
    const apple = buildAppleMapsDirectionsUrl(32.1, 34.8)!;

    expect(waze.startsWith("https://waze.com/ul?")).toBe(true);
    expect(waze).toContain("navigate=yes");
    expect(waze).not.toContain("utm_");
    expect(waze).not.toContain("user");

    expect(google.startsWith("https://www.google.com/maps/dir/?")).toBe(true);
    expect(google).toContain("api=1");
    expect(google).not.toContain("origin=");

    expect(apple.startsWith("https://maps.apple.com/?")).toBe(true);
    expect(apple).not.toContain("dirflg=");
  });

  it("offers Apple Maps only on clear iPhone/iPad/iPod user agents", () => {
    expect(shouldOfferAppleMaps("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe(
      true,
    );
    expect(shouldOfferAppleMaps("Mozilla/5.0 (iPad; CPU OS 17_0)")).toBe(true);
    expect(
      shouldOfferAppleMaps(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      ),
    ).toBe(false);
    expect(
      shouldOfferAppleMaps(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605.1.15",
      ),
    ).toBe(false);
  });

  it("builds the full link set and omits Apple Maps when not requested", () => {
    const withApple = buildExternalNavigationLinks(32.1, 34.8, {
      includeAppleMaps: true,
    });
    expect(withApple?.appleMaps).toContain("maps.apple.com");

    const withoutApple = buildExternalNavigationLinks(32.1, 34.8, {
      includeAppleMaps: false,
    });
    expect(withoutApple?.appleMaps).toBeNull();
    expect(withoutApple?.waze).toContain("waze.com");
    expect(withoutApple?.googleMaps).toContain("google.com/maps");

    expect(buildExternalNavigationLinks(999, 34)).toBeNull();
  });
});
