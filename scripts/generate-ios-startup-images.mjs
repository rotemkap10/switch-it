/**
 * Generates static iOS apple-touch-startup-image PNGs into public/pwa/startup/.
 * Run: node scripts/generate-ios-startup-images.mjs
 *
 * Lockup must stay aligned with AppIconMarkup + AppLaunchShell (88px icon, 20px wordmark).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ImageResponse } from "next/og.js";
import { createElement } from "react";

const BACKGROUND = "#dff4ff";
const WORDMARK_COLOR = "#12324a";
const ICON_TILE = "#55bff3";

const ICON_CSS_PX = 88;
const WORDMARK_CSS_PX = 20;
const GAP_CSS_PX = 14;

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

function pinSvg(size) {
  const svgSize = Math.round(size * 0.58);
  return createElement(
    "svg",
    {
      width: svgSize,
      height: svgSize,
      viewBox: "0 0 64 64",
      fill: "none",
      xmlns: "http://www.w3.org/2000/svg",
    },
    createElement("path", {
      d: "M32 58c0 0 11-11.2 11-20.8a11 11 0 1 0-22 0C21 46.8 32 58 32 58Z",
      fill: "#ffffff",
    }),
    createElement("circle", { cx: "32", cy: "24", r: "6", fill: ICON_TILE }),
    createElement("path", {
      d: "M18 14h6l-3 6-3-6Zm22 0h6l-3 6-3-6Z",
      fill: "#ffffff",
      opacity: "0.95",
    }),
    createElement("path", {
      d: "M21 12c2-2 5-2 7 0M43 12c-2-2-5-2-7 0",
      stroke: "#ffffff",
      strokeWidth: "2.5",
      strokeLinecap: "round",
    }),
  );
}

function iconMark(size) {
  const radius = Math.round(size * 0.22);
  return createElement(
    "div",
    {
      style: {
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: ICON_TILE,
        borderRadius: radius,
      },
    },
    pinSvg(size),
  );
}

function splashMarkup(scale) {
  const iconSize = Math.round(ICON_CSS_PX * scale);
  const wordmarkSize = Math.round(WORDMARK_CSS_PX * scale);
  const gap = Math.round(GAP_CSS_PX * scale);

  return createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: BACKGROUND,
        gap,
      },
    },
    iconMark(iconSize),
    createElement(
      "div",
      {
        style: {
          display: "flex",
          fontSize: wordmarkSize,
          fontWeight: 600,
          letterSpacing: "0.01em",
          color: WORDMARK_COLOR,
          lineHeight: 1.1,
        },
      },
      "Switch It",
    ),
  );
}

const outDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../public/pwa/startup",
);
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
