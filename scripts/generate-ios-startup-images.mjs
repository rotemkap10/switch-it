/**
 * Generates static iOS apple-touch-startup-image PNGs into public/pwa/startup/.
 * Run: node scripts/generate-ios-startup-images.mjs
 *
 * Lockup must stay aligned with AppLaunchShell (centered official logo PNG,
 * ~72% of the shorter viewport side, light brand fill #dff4ff).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ImageResponse } from "next/og.js";
import { createElement } from "react";
import sharp from "sharp";

const BACKGROUND = "#dff4ff";
const LOGO_RATIO = 0.72;

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logoPath = resolve(rootDir, "public/branding/switch-it-logo.png");
const logoPng = readFileSync(logoPath);
const logoSrc = `data:image/png;base64,${logoPng.toString("base64")}`;
const logoMeta = await sharp(logoPath).metadata();
const LOGO_ASPECT = logoMeta.width / logoMeta.height;

/** Portrait launch sizes — keep in sync with src/lib/pwa/ios-startup.ts */
const IMAGES = [
  { cssWidth: 320, cssHeight: 568, scale: 2 },
  { cssWidth: 375, cssHeight: 667, scale: 2 },
  { cssWidth: 414, cssHeight: 736, scale: 3 },
  { cssWidth: 375, cssHeight: 812, scale: 3 },
  { cssWidth: 414, cssHeight: 896, scale: 2 },
  { cssWidth: 414, cssHeight: 896, scale: 3 },
  { cssWidth: 390, cssHeight: 844, scale: 3 },
  { cssWidth: 428, cssHeight: 926, scale: 3 },
  { cssWidth: 393, cssHeight: 852, scale: 3 },
  { cssWidth: 430, cssHeight: 932, scale: 3 },
  { cssWidth: 402, cssHeight: 874, scale: 3 },
  { cssWidth: 440, cssHeight: 956, scale: 3 },
  { cssWidth: 420, cssHeight: 912, scale: 3 },
];

function splashMarkup(cssWidth, cssHeight, scale, landscape) {
  const canvasCssW = landscape ? cssHeight : cssWidth;
  const canvasCssH = landscape ? cssWidth : cssHeight;
  const logoCss = Math.round(Math.min(cssWidth, cssHeight) * LOGO_RATIO);
  const logoWidth = logoCss * scale;
  const logoHeight = Math.round(logoWidth / LOGO_ASPECT);

  return {
    element: createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: BACKGROUND,
        },
      },
      createElement("img", {
        src: logoSrc,
        width: logoWidth,
        height: logoHeight,
      }),
    ),
    width: canvasCssW * scale,
    height: canvasCssH * scale,
  };
}

async function writeSplash(fileName, cssWidth, cssHeight, scale, landscape) {
  const { element, width, height } = splashMarkup(
    cssWidth,
    cssHeight,
    scale,
    landscape,
  );
  const response = new ImageResponse(element, { width, height });
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(resolve(outDir, fileName), buffer);
  console.log(`wrote ${fileName} (${width}×${height}, ${buffer.length} bytes)`);
}

const outDir = resolve(rootDir, "public/pwa/startup");
mkdirSync(outDir, { recursive: true });

for (const image of IMAGES) {
  const portraitName = `iphone-${image.cssWidth}x${image.cssHeight}-${image.scale}x.png`;
  const landscapeName = `iphone-${image.cssWidth}x${image.cssHeight}-${image.scale}x-landscape.png`;
  await writeSplash(
    portraitName,
    image.cssWidth,
    image.cssHeight,
    image.scale,
    false,
  );
  await writeSplash(
    landscapeName,
    image.cssWidth,
    image.cssHeight,
    image.scale,
    true,
  );
}

const fallbackFileName = "iphone-portrait-fallback.png";
await writeSplash(fallbackFileName, 430, 932, 3, false);

const launchLogoPath = resolve(rootDir, "public/branding/switch-it-logo-launch.png");
await sharp(logoPath)
  .resize({ width: 880, withoutEnlargement: true })
  .png({ compressionLevel: 9 })
  .toFile(launchLogoPath);
console.log("wrote switch-it-logo-launch.png (880px lockup copy)");
