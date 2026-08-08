/**
 * Generates static iOS apple-touch-startup-image PNGs into public/pwa/startup/.
 * Run: node scripts/generate-ios-startup-images.mjs
 *
 * Lockup must stay aligned with AppLaunchShell (centered official logo PNG).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ImageResponse } from "next/og.js";
import { createElement } from "react";

const BACKGROUND = "#dff4ff";
const LOGO_CSS_PX = 200;

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logoPng = readFileSync(resolve(rootDir, "public/branding/switch-it-logo.png"));
const logoSrc = `data:image/png;base64,${logoPng.toString("base64")}`;

/** Portrait launch sizes — keep in sync with src/lib/pwa/ios-startup.ts */
const IMAGES = [
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
];

function splashMarkup(scale) {
  const logoSize = Math.round(LOGO_CSS_PX * scale);

  return createElement(
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
      width: logoSize,
      height: logoSize,
    }),
  );
}

const outDir = resolve(rootDir, "public/pwa/startup");
mkdirSync(outDir, { recursive: true });

for (const image of IMAGES) {
  const width = image.cssWidth * image.scale;
  const height = image.cssHeight * image.scale;
  const fileName = `iphone-${image.cssWidth}x${image.cssHeight}-${image.scale}x.png`;
  const response = new ImageResponse(splashMarkup(image.scale), {
    width,
    height,
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(resolve(outDir, fileName), buffer);
  console.log(`wrote ${fileName} (${width}×${height}, ${buffer.length} bytes)`);
}

const fallbackFileName = "iphone-portrait-fallback.png";
const fallbackWidth = 1290;
const fallbackHeight = 2796;
const fallbackResponse = new ImageResponse(splashMarkup(3), {
  width: fallbackWidth,
  height: fallbackHeight,
});
const fallbackBuffer = Buffer.from(await fallbackResponse.arrayBuffer());
writeFileSync(resolve(outDir, fallbackFileName), fallbackBuffer);
console.log(
  `wrote ${fallbackFileName} (${fallbackWidth}×${fallbackHeight}, ${fallbackBuffer.length} bytes)`,
);
