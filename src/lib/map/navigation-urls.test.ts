import { describe, expect, it } from "vitest";

import {
  buildAppleMapsDirectionsUrl,
  buildExternalNavigationLinks,
  buildGoogleMapsDirectionsUrl,
  buildWazeNavigateUrl,
  formatNavigationCoordinate,
  isValidNavigationCoords,
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
    expect(isValidNavigationCoords(undefined, 34)).toBe(false);
  });

  it("formats coordinates consistently", () => {
    expect(formatNavigationCoordinate(32.0853124)).toBe("32.085312");
    expect(formatNavigationCoordinate(-34.7818)).toBe("-34.781800");
  });

  it("builds a Waze HTTPS deep link with exact destination and navigate=yes", () => {
    const url = buildWazeNavigateUrl(32.085312, 34.781812);
    expect(url).toBe(
      "https://waze.com/ul?ll=32.085312%2C34.781812&navigate=yes&utm_source=switch_it",
    );
    expect(url).toContain("ll=32.085312%2C34.781812");
    expect(url).toContain("navigate=yes");
    expect(url).toContain("utm_source=switch_it");
  });

  it("builds a Google Maps URL with api=1, driving mode, and navigate action", () => {
    const url = buildGoogleMapsDirectionsUrl(32.085312, 34.781812);
    expect(url).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=32.085312%2C34.781812&travelmode=driving&dir_action=navigate",
    );
    expect(url).toContain("api=1");
    expect(url).toContain("destination=32.085312%2C34.781812");
    expect(url).toContain("travelmode=driving");
    expect(url).toContain("dir_action=navigate");
    expect(url).not.toContain("origin=");
  });

  it("builds an Apple Maps driving link with exact destination", () => {
    const url = buildAppleMapsDirectionsUrl(32.085312, -34.781812);
    expect(url).toBe(
      "https://maps.apple.com/?daddr=32.085312%2C-34.781812&dirflg=d",
    );
    expect(url).toContain("daddr=32.085312%2C-34.781812");
    expect(url).toContain("dirflg=d");
    expect(url).not.toContain("saddr=");
  });

  it("returns null URL builders for invalid latitude or longitude", () => {
    expect(buildWazeNavigateUrl(91, 34)).toBeNull();
    expect(buildGoogleMapsDirectionsUrl(32, 200)).toBeNull();
    expect(buildAppleMapsDirectionsUrl(Number.NaN, 34)).toBeNull();
    expect(buildExternalNavigationLinks(999, 34)).toBeNull();
  });

  it("always includes Waze, Apple Maps, and Google Maps for valid coordinates", () => {
    const links = buildExternalNavigationLinks(32.1, 34.8);
    expect(links?.waze).toContain("waze.com/ul");
    expect(links?.appleMaps).toContain("maps.apple.com");
    expect(links?.googleMaps).toContain("google.com/maps/dir");
  });
});
