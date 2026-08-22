/**
 * Generates static iOS apple-touch-startup-image PNGs into public/pwa/startup/.
 * Run: node scripts/generate-ios-startup-images.mjs
 *
 * Centered square app icon only (~30% of the shorter viewport side),
 * light brand fill #dff4ff — aligned with native splash + BootSplash.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { renderAppIconTile } from "./lib/extract-app-mark.mjs";

const BACKGROUND = "#dff4ff";
const ICON_RATIO = 0.3;

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logoPath = resolve(rootDir, "public/branding/switch-it-logo.png");

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

async function writeSplash(fileName, cssWidth, cssHeight, scale, landscape) {
  const canvasCssW = landscape ? cssHeight : cssWidth;
  const canvasCssH = landscape ? cssWidth : cssHeight;
  const width = canvasCssW * scale;
  const height = canvasCssH * scale;
  const iconSize = Math.round(Math.min(cssWidth, cssHeight) * ICON_RATIO * scale);
  const iconTile = await renderAppIconTile(logoPath, iconSize);

  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([{ input: iconTile, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toBuffer();

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

await writeSplash("iphone-portrait-fallback.png", 430, 932, 3, false);

const launchIconPath = resolve(rootDir, "public/branding/switch-it-launch-icon.png");
const launchIconBuffer = await renderAppIconTile(logoPath, 512);
writeFileSync(launchIconPath, launchIconBuffer);
console.log("wrote switch-it-launch-icon.png (512×512 app icon tile)");
