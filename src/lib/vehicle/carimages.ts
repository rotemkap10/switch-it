export const CARIMAGES_LOADER_SRC =
  "https://carimagesapi.com/assets/js/carimages.js";
export const CARIMAGES_VIEW = "front34";
export const CARIMAGES_FORMAT = "webp";
export const CARIMAGES_TYPE = "car";

export type VehicleImageSize = "default" | "compact" | "hero";

declare global {
  interface Window {
    CI_API_KEY?: string;
    CI_DEFAULT_TYPE?: string;
  }
}

/** Public JS-loader key only. Never read or ship the API secret from the client. */
export function getCarImagesPublicApiKey(): string | null {
  const key = process.env.NEXT_PUBLIC_CARIMAGES_API_KEY?.trim();
  return key ? key : null;
}

export function isCarImagesLoaderEnabled(): boolean {
  return Boolean(getCarImagesPublicApiKey()) && process.env.NODE_ENV !== "test";
}

/** Daily cache-bust token used by the official loader snippet. */
export function carImagesLoaderCacheBust(): string {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

export function carImagesWidthForSize(size: VehicleImageSize): "400" | "800" {
  return size === "compact" ? "400" : "800";
}

export function normalizeCarImagesYear(
  year: string | number | null | undefined,
): string | undefined {
  if (year == null) {
    return undefined;
  }
  const value = String(year).trim();
  return value.length > 0 ? value : undefined;
}

/**
 * Real catalog images redirect to the CDN vehicle library.
 * Unknown make/model stays on `/image` as a generic placeholder (valid WebP).
 */
export function isUsableCarImagesUrl(src: string | null | undefined): boolean {
  if (!src) {
    return false;
  }

  try {
    const url = new URL(src, "https://carimagesapi.com");
    return (
      url.hostname === "cdn.carimagesapi.com" &&
      url.pathname.startsWith("/vehicles/")
    );
  } catch {
    return false;
  }
}
