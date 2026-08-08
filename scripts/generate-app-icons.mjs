/**
 * Extract the official square Switch It mark and write Home Screen / PWA icons.
 * Does not change the in-app horizontal lockup.
 *
 * Run: node scripts/generate-app-icons.mjs
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logoPath = resolve(rootDir, "public/branding/switch-it-logo.png");

const { data, info } = await sharp(logoPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height } = info;
const colCounts = Array(width).fill(0);

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    if (data[(y * width + x) * 4 + 3] >= 20) {
      colCounts[x] += 1;
    }
  }
}

let iconRight = width;
for (let x = 24; x < width - 24; x += 1) {
  if (colCounts[x] < height * 0.02 && colCounts[x + 8] < height * 0.02) {
    iconRight = x;
    break;
  }
}

let minX = width;
let minY = height;
let maxX = 0;
let maxY = 0;
const cyanSamples = [];

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < iconRight; x += 1) {
    const i = (y * width + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 20) {
      continue;
    }
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (b > 180 && g > 140 && r < 140 && a > 200) {
      cyanSamples.push([r, g, b]);
    }
  }
}

if (maxX <= minX || maxY <= minY) {
  throw new Error("Could not locate the square Switch It mark in the lockup.");
}

const crop = {
  left: minX,
  top: minY,
  width: maxX - minX + 1,
  height: maxY - minY + 1,
};

const fill = cyanSamples
  .reduce(
    (acc, [r, g, b]) => {
      acc[0] += r;
      acc[1] += g;
      acc[2] += b;
      return acc;
    },
    [0, 0, 0],
  )
  .map((channel) => Math.round(channel / Math.max(1, cyanSamples.length)));

const fillRgba = { r: fill[0], g: fill[1], b: fill[2], alpha: 1 };
const mark = await sharp(logoPath).extract(crop).png().toBuffer();

async function writeIcon(outPath, size, { safeZone = 1 } = {}) {
  const inner = Math.max(1, Math.round(size * safeZone));
  const resized = await sharp(mark)
    .resize(inner, inner, { fit: "contain", background: fillRgba })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: fillRgba,
    },
  })
    .composite([{ input: resized, gravity: "centre" }])
    .png()
    .toFile(outPath);

  console.log(
    `wrote ${outPath.replace(`${rootDir}/`, "")} (${size}×${size}, fill rgb(${fill.join(",")}))`,
  );
}

mkdirSync(resolve(rootDir, "public/pwa"), { recursive: true });

await writeIcon(resolve(rootDir, "public/apple-touch-icon.png"), 180);
await writeIcon(resolve(rootDir, "public/pwa/icon-192.png"), 192);
await writeIcon(resolve(rootDir, "public/pwa/icon-512.png"), 512);
await writeIcon(resolve(rootDir, "public/pwa/icon-maskable-512.png"), 512, {
  safeZone: 0.8,
});

console.log(
  "app icon mark crop",
  crop,
  `fill #${fill.map((c) => c.toString(16).padStart(2, "0")).join("")}`,
);
