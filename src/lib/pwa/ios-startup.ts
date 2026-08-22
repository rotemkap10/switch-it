/**
 * iOS Home Screen launch images (`apple-touch-startup-image`).
 *
 * Portrait + landscape device-specific images use exact CSS viewport × DPR.
 * If none match (new iPhone, Display Zoom, future sizes), iOS uses the
 * unqualified fallback instead of a black frame.
 *
 * Declaration order in HTML (deliberate):
 *   1. Device-specific links WITH media queries (pixel-perfect when matched)
 *   2. Unqualified fallback LAST (no media) — used when nothing matches
 *
 * iOS picks the first matching startup image. A no-media link first would
 * shadow every specific size. Specific-first + fallback-last is required.
 *
 * Startup images only apply when `apple-mobile-web-app-capable=yes` is present.
 * Re-add the Home Screen icon after changing these files so iOS recaches them.
 */

import { PWA_BACKGROUND_COLOR } from "@/lib/pwa/brand-colors";

/** Square app icon as a fraction of the shorter viewport side (~30%). */
export const IOS_STARTUP_LOGO_RATIO = 0.3;

export type IosStartupOrientation = "portrait" | "landscape";

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
  orientation: IosStartupOrientation;
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

type DeviceSpec = {
  cssWidth: number;
  cssHeight: number;
  scale: 2 | 3;
  devices: string;
};

const DEVICE_SPECS: readonly DeviceSpec[] = [
  { cssWidth: 320, cssHeight: 568, scale: 2, devices: "iPhone SE (1st gen)" },
  { cssWidth: 375, cssHeight: 667, scale: 2, devices: "iPhone SE (2nd/3rd gen), iPhone 8" },
  { cssWidth: 414, cssHeight: 736, scale: 3, devices: "iPhone 8 Plus" },
  {
    cssWidth: 375,
    cssHeight: 812,
    scale: 3,
    devices: "iPhone X, XS, 11 Pro, 12 mini, 13 mini, Display Zoom Pro",
  },
  { cssWidth: 414, cssHeight: 896, scale: 2, devices: "iPhone XR, 11" },
  { cssWidth: 414, cssHeight: 896, scale: 3, devices: "iPhone XS Max, 11 Pro Max" },
  { cssWidth: 390, cssHeight: 844, scale: 3, devices: "iPhone 12, 13, 14, 12/13 Pro, 16e" },
  { cssWidth: 428, cssHeight: 926, scale: 3, devices: "iPhone 12/13/14 Pro Max, 14 Plus" },
  { cssWidth: 393, cssHeight: 852, scale: 3, devices: "iPhone 14 Pro, 15, 15 Pro, 16" },
  { cssWidth: 430, cssHeight: 932, scale: 3, devices: "iPhone 15 Plus, 15 Pro Max, 16 Plus" },
  { cssWidth: 402, cssHeight: 874, scale: 3, devices: "iPhone 16 Pro, 17, 17 Pro" },
  { cssWidth: 440, cssHeight: 956, scale: 3, devices: "iPhone 16 Pro Max, 17 Pro Max" },
  { cssWidth: 420, cssHeight: 912, scale: 3, devices: "iPhone Air" },
];

export function iosStartupLogoCssPx(cssWidth: number, cssHeight: number): number {
  return Math.round(Math.min(cssWidth, cssHeight) * IOS_STARTUP_LOGO_RATIO);
}

function portraitMedia(
  cssWidth: number,
  cssHeight: number,
  scale: 2 | 3,
): string {
  return `(device-width: ${cssWidth}px) and (device-height: ${cssHeight}px) and (-webkit-device-pixel-ratio: ${scale}) and (orientation: portrait)`;
}

function landscapeMedia(
  cssWidth: number,
  cssHeight: number,
  scale: 2 | 3,
): string {
  return `(device-width: ${cssWidth}px) and (device-height: ${cssHeight}px) and (-webkit-device-pixel-ratio: ${scale}) and (orientation: landscape)`;
}

function portraitEntry(spec: DeviceSpec): IosStartupImage {
  const fileName = `iphone-${spec.cssWidth}x${spec.cssHeight}-${spec.scale}x.png`;
  return {
    fileName,
    href: `/pwa/startup/${fileName}`,
    cssWidth: spec.cssWidth,
    cssHeight: spec.cssHeight,
    scale: spec.scale,
    width: spec.cssWidth * spec.scale,
    height: spec.cssHeight * spec.scale,
    media: portraitMedia(spec.cssWidth, spec.cssHeight, spec.scale),
    devices: spec.devices,
    orientation: "portrait",
  };
}

function landscapeEntry(spec: DeviceSpec): IosStartupImage {
  const fileName = `iphone-${spec.cssWidth}x${spec.cssHeight}-${spec.scale}x-landscape.png`;
  return {
    fileName,
    href: `/pwa/startup/${fileName}`,
    cssWidth: spec.cssWidth,
    cssHeight: spec.cssHeight,
    scale: spec.scale,
    width: spec.cssHeight * spec.scale,
    height: spec.cssWidth * spec.scale,
    media: landscapeMedia(spec.cssWidth, spec.cssHeight, spec.scale),
    devices: spec.devices,
    orientation: "landscape",
  };
}

/** Common current iPhone launch sizes (CSS px × DPR), portrait then landscape. */
export const IOS_STARTUP_IMAGES: readonly IosStartupImage[] = [
  ...DEVICE_SPECS.map(portraitEntry),
  ...DEVICE_SPECS.map(landscapeEntry),
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
