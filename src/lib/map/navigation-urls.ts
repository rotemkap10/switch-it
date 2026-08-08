/**
 * Pure helpers for external navigation deep links (Waze / Apple Maps / Google Maps).
 * Destination coordinates only — no origin, no ETA, no Routes API.
 */

export type NavigationCoords = {
  latitude: number;
  longitude: number;
};

export type NavigationProviderId = "waze" | "googleMaps" | "appleMaps";

export const NAVIGATION_PROVIDER_LABELS: Record<NavigationProviderId, string> = {
  waze: "Waze",
  googleMaps: "Google Maps",
  appleMaps: "Apple Maps",
};

export function isValidNavigationCoords(
  latitude: unknown,
  longitude: unknown,
): boolean {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/** Stable decimal formatting for deep-link coordinates. */
export function formatNavigationCoordinate(value: number): string {
  return value.toFixed(6);
}

function destinationPair(latitude: number, longitude: number): string {
  return `${formatNavigationCoordinate(latitude)},${formatNavigationCoordinate(longitude)}`;
}

export function buildWazeNavigateUrl(
  latitude: number,
  longitude: number,
): string | null {
  if (!isValidNavigationCoords(latitude, longitude)) {
    return null;
  }
  const url = new URL("https://waze.com/ul");
  url.searchParams.set("ll", destinationPair(latitude, longitude));
  url.searchParams.set("navigate", "yes");
  url.searchParams.set("utm_source", "switch_it");
  return url.toString();
}

export function buildGoogleMapsDirectionsUrl(
  latitude: number,
  longitude: number,
): string | null {
  if (!isValidNavigationCoords(latitude, longitude)) {
    return null;
  }
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", destinationPair(latitude, longitude));
  url.searchParams.set("travelmode", "driving");
  url.searchParams.set("dir_action", "navigate");
  return url.toString();
}

export function buildAppleMapsDirectionsUrl(
  latitude: number,
  longitude: number,
): string | null {
  if (!isValidNavigationCoords(latitude, longitude)) {
    return null;
  }
  const url = new URL("https://maps.apple.com/");
  url.searchParams.set("daddr", destinationPair(latitude, longitude));
  url.searchParams.set("dirflg", "d");
  return url.toString();
}

export type ExternalNavigationLinks = {
  waze: string;
  appleMaps: string;
  googleMaps: string;
};

export function buildExternalNavigationLinks(
  latitude: number,
  longitude: number,
): ExternalNavigationLinks | null {
  const waze = buildWazeNavigateUrl(latitude, longitude);
  const appleMaps = buildAppleMapsDirectionsUrl(latitude, longitude);
  const googleMaps = buildGoogleMapsDirectionsUrl(latitude, longitude);
  if (!waze || !appleMaps || !googleMaps) {
    return null;
  }
  return { waze, appleMaps, googleMaps };
}

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const mediaStandalone = window.matchMedia?.("(display-mode: standalone)")
    ?.matches;
  const iosStandalone = Boolean(
    "standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone,
  );
  return Boolean(mediaStandalone || iosStandalone);
}

function clickExternalAnchor(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * Open an HTTPS navigation deep link outside Switch It.
 * Standalone iOS PWAs prefer a user-gesture <a target="_blank"> so Universal
 * Links can hand off to Waze / Maps without unloading the PWA.
 */
export function openExternalNavigationUrl(url: string) {
  if (typeof window === "undefined") {
    return;
  }
  if (isStandaloneDisplay()) {
    clickExternalAnchor(url);
    return;
  }
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    clickExternalAnchor(url);
  }
}
