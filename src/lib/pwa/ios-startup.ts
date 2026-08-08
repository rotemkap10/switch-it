/**
 * iOS Home Screen launch images (`apple-touch-startup-image`).
 *
 * Portrait only — Switch It is phone-first portrait. Landscape falls back to
 * the light html/body background rather than a stretched raster.
 *
 * Pixel size must match device CSS size × scale exactly or iOS ignores the asset.
 * Re-add the Home Screen icon after changing these files so iOS recaches them.
 */

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

/** Common current iPhone portrait launch sizes. */
export const IOS_STARTUP_IMAGES: readonly IosStartupImage[] = [
  entry(375, 667, 2, "iPhone SE (2nd/3rd gen), iPhone 8"),
  entry(414, 736, 3, "iPhone 8 Plus"),
  entry(375, 812, 3, "iPhone X, XS, 11 Pro, 12 mini, 13 mini"),
  entry(414, 896, 2, "iPhone XR, 11"),
  entry(414, 896, 3, "iPhone XS Max, 11 Pro Max"),
  entry(390, 844, 3, "iPhone 12, 13, 14, 12/13 Pro, 16e"),
  entry(428, 926, 3, "iPhone 12/13/14 Pro Max, 14 Plus"),
  entry(393, 852, 3, "iPhone 14 Pro, 15, 15 Pro, 16"),
  entry(430, 932, 3, "iPhone 15 Plus, 15 Pro Max, 16 Plus"),
  entry(402, 874, 3, "iPhone 16 Pro"),
  entry(440, 956, 3, "iPhone 16 Pro Max"),
];

export function iosStartupAppleWebAppImages() {
  return IOS_STARTUP_IMAGES.map((image) => ({
    url: image.href,
    media: image.media,
  }));
}
