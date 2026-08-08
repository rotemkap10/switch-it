/**
 * iOS Home Screen launch images (`apple-touch-startup-image`).
 *
 * Portrait device-specific images use exact CSS viewport × DPR. If none match
 * (new iPhone, Display Zoom, future sizes), iOS uses the unqualified fallback
 * instead of a black frame.
 *
 * Declaration order in HTML (deliberate):
 *   1. Device-specific links WITH media queries (pixel-perfect when matched)
 *   2. Unqualified fallback LAST (no media) — used when nothing matches
 *
 * iOS picks the first matching startup image. A no-media link first would
 * shadow every specific size. Specific-first + fallback-last is required.
 *
 * Re-add the Home Screen icon after changing these files so iOS recaches them.
 */

import { PWA_BACKGROUND_COLOR } from "@/lib/pwa/brand-colors";

export const IOS_STARTUP_ICON_CSS_PX = 88;
export const IOS_STARTUP_WORDMARK_CSS_PX = 20;
export const IOS_STARTUP_GAP_CSS_PX = 14;

export type IosStartupImage = {
  /** Filename without directory, including .png */
  fileName: string;
  href: string;
  cssWidth: number;
  cssHeight: number;
  scale: 2 | 3;
  width: number;
  height: number;
  media: string;
  devices: string;
};

export type IosStartupFallback = {
  fileName: string;
  href: string;
  width: number;
  height: number;
  scale: 3;
  /** Unqualified — must not set a media query. */
  media: null;
  devices: string;
};

function portraitMedia(
  cssWidth: number,
  cssHeight: number,
  scale: 2 | 3,
): string {
  return `(device-width: ${cssWidth}px) and (device-height: ${cssHeight}px) and (-webkit-device-pixel-ratio: ${scale}) and (orientation: portrait)`;
}

function entry(
  cssWidth: number,
  cssHeight: number,
  scale: 2 | 3,
  devices: string,
): IosStartupImage {
  const width = cssWidth * scale;
  const height = cssHeight * scale;
  const fileName = `iphone-${cssWidth}x${cssHeight}-${scale}x.png`;
  return {
    fileName,
    href: `/pwa/startup/${fileName}`,
    cssWidth,
    cssHeight,
    scale,
    width,
    height,
    media: portraitMedia(cssWidth, cssHeight, scale),
    devices,
  };
}

/** Common current iPhone portrait launch sizes (CSS px × DPR). */
export const IOS_STARTUP_IMAGES: readonly IosStartupImage[] = [
  entry(375, 667, 2, "iPhone SE (2nd/3rd gen), iPhone 8"),
  entry(414, 736, 3, "iPhone 8 Plus"),
  entry(375, 812, 3, "iPhone X, XS, 11 Pro, 12 mini, 13 mini, Display Zoom Pro"),
  entry(414, 896, 2, "iPhone XR, 11"),
  entry(414, 896, 3, "iPhone XS Max, 11 Pro Max"),
  entry(390, 844, 3, "iPhone 12, 13, 14, 12/13 Pro, 16e"),
  entry(428, 926, 3, "iPhone 12/13/14 Pro Max, 14 Plus"),
  entry(393, 852, 3, "iPhone 14 Pro, 15, 15 Pro, 16"),
  entry(430, 932, 3, "iPhone 15 Plus, 15 Pro Max, 16 Plus"),
  entry(402, 874, 3, "iPhone 16 Pro"),
  entry(440, 956, 3, "iPhone 16 Pro Max"),
];

/**
 * Large modern portrait lockup (430×932 @3). iOS may scale it when used as
 * the unqualified fallback. Same visual as device-specific assets.
 */
export const IOS_STARTUP_FALLBACK: IosStartupFallback = {
  fileName: "iphone-portrait-fallback.png",
  href: "/pwa/startup/iphone-portrait-fallback.png",
  width: 1290,
  height: 2796,
  scale: 3,
  media: null,
  devices: "Unmatched / future iPhones (no media query)",
};

export const IOS_STARTUP_BACKGROUND = PWA_BACKGROUND_COLOR;

export function allIosStartupHrefs(): string[] {
  return [
    ...IOS_STARTUP_IMAGES.map((image) => image.href),
    IOS_STARTUP_FALLBACK.href,
  ];
}

export function iosStartupAppleWebAppImages() {
  return [
    ...IOS_STARTUP_IMAGES.map((image) => ({
      url: image.href,
      media: image.media,
    })),
    { url: IOS_STARTUP_FALLBACK.href },
  ];
}
