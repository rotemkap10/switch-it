export const CARIMAGES_LOADER_SRC =
  "https://carimagesapi.com/assets/js/carimages.js";
export const CARIMAGES_VIEW = "front34";
export const CARIMAGES_FORMAT = "webp";
export const CARIMAGES_TYPE = "car";

export type VehicleImageSize = "default" | "compact" | "handoff" | "hero";

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
  return size === "compact" || size === "handoff" ? "400" : "800";
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

/** Host + path only. Never include query (api_key / sig / expires). */
export function carImagesSrcHostPath(src: string | null | undefined): string {
  if (!src) {
    return "(empty)";
  }
  try {
    const url = new URL(src, "https://carimagesapi.com");
    return `${url.host}${url.pathname}`;
  } catch {
    return "(invalid)";
  }
}

export function logCarImages(message: string): void {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  console.info(`[switch-it:carimages] ${message}`);
}

/**
 * The official JS loader assigns signed `carimagesapi.com/image?...` URLs.
 * After the browser follows a 302, currentSrc may be the CDN `/vehicles/` file.
 * Both are successful loader resolutions — not failures.
 */
export function isCarImagesLoaderResolvedSrc(
  src: string | null | undefined,
): boolean {
  if (!src) {
    return false;
  }

  try {
    const url = new URL(src, "https://carimagesapi.com");
    const host = url.hostname;
    if (host === "cdn.carimagesapi.com" && url.pathname.startsWith("/vehicles/")) {
      return true;
    }
    return (
      (host === "carimagesapi.com" || host === "www.carimagesapi.com") &&
      url.pathname === "/image"
    );
  } catch {
    return false;
  }
}

/** @deprecated Use isCarImagesLoaderResolvedSrc. */
export function isUsableCarImagesUrl(src: string | null | undefined): boolean {
  return isCarImagesLoaderResolvedSrc(src);
}
