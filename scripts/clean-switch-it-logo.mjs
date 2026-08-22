/**
 * Removes the baked-in square fill from the official Switch It logo and
 * recolors opaque pixels to the strict two-color brand palette.
 * Does not redesign the mark — only flood-fills the outer background to
 * transparent, recolors, and crops to the lockup.
 * Run: npm run clean:logo
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(rootDir, "scripts/assets/switch-it-logo-source.png");
const outPath = resolve(rootDir, "public/branding/switch-it-logo.png");

const SIGNAL_BLUE = [0, 87, 255];
const PORCELAIN = [248, 247, 244];

const COLOR_TOLERANCE = 34;
const EDGE_SOFTNESS = 18;
const CROP_PADDING = 16;

function colorDist(r, g, b, bg) {
  return Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
}

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Map legacy logo pixels to Signal Blue or Porcelain without changing geometry. */
function brandRecolor(r, g, b, alpha) {
  if (alpha < 20) {
    return [r, g, b, 0];
  }
  const lum = luminance(r, g, b);
  const target = lum > 210 ? PORCELAIN : SIGNAL_BLUE;
  return [...target, alpha];
}

const { data, info } = await sharp(sourcePath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
if (channels !== 4) {
  throw new Error(`expected RGBA, got ${channels} channels`);
}

const idx = (x, y) => (y * width + x) * 4;

const corners = [
  [0, 0],
  [width - 1, 0],
  [0, height - 1],
  [width - 1, height - 1],
];
const bg = [0, 0, 0];
for (const [x, y] of corners) {
  const i = idx(x, y);
  bg[0] += data[i];
  bg[1] += data[i + 1];
  bg[2] += data[i + 2];
}
bg[0] = Math.round(bg[0] / corners.length);
bg[1] = Math.round(bg[1] / corners.length);
bg[2] = Math.round(bg[2] / corners.length);

const background = new Uint8Array(width * height);
const queue = [];

function enqueue(x, y) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const p = y * width + x;
  if (background[p]) return;
  const i = idx(x, y);
  if (colorDist(data[i], data[i + 1], data[i + 2], bg) > COLOR_TOLERANCE) return;
  background[p] = 1;
  queue.push(x, y);
}

for (let x = 0; x < width; x++) {
  enqueue(x, 0);
  enqueue(x, height - 1);
}
for (let y = 0; y < height; y++) {
  enqueue(0, y);
  enqueue(width - 1, y);
}

while (queue.length) {
  const y = queue.pop();
  const x = queue.pop();
  enqueue(x - 1, y);
  enqueue(x + 1, y);
  enqueue(x, y - 1);
  enqueue(x, y + 1);
}

const out = Buffer.from(data);
let minX = width;
let minY = height;
let maxX = -1;
let maxY = -1;

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const p = y * width + x;
    const i = idx(x, y);
    if (background[p]) {
      out[i + 3] = 0;
      continue;
    }

    const dist = colorDist(out[i], out[i + 1], out[i + 2], bg);
    const neighborBg =
      (x > 0 && background[p - 1]) ||
      (x + 1 < width && background[p + 1]) ||
      (y > 0 && background[p - width]) ||
      (y + 1 < height && background[p + width]);

    if (neighborBg && dist < COLOR_TOLERANCE + EDGE_SOFTNESS) {
      const alpha = Math.max(
        0,
        Math.min(255, Math.round((dist / COLOR_TOLERANCE) * 255)),
      );
      out[i + 3] = alpha;
      if (alpha === 0) continue;
    }

    const [nr, ng, nb, na] = brandRecolor(out[i], out[i + 1], out[i + 2], out[i + 3]);
    out[i] = nr;
    out[i + 1] = ng;
    out[i + 2] = nb;
    out[i + 3] = na;

    if (out[i + 3] > 8) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
}

if (maxX < minX || maxY < minY) {
  throw new Error("logo crop failed — no opaque pixels remained");
}

const cropLeft = Math.max(0, minX - CROP_PADDING);
const cropTop = Math.max(0, minY - CROP_PADDING);
const cropWidth = Math.min(width, maxX + 1 + CROP_PADDING) - cropLeft;
const cropHeight = Math.min(height, maxY + 1 + CROP_PADDING) - cropTop;

const cleaned = await sharp(out, {
  raw: { width, height, channels: 4 },
})
  .extract({
    left: cropLeft,
    top: cropTop,
    width: cropWidth,
    height: cropHeight,
  })
  .png({ compressionLevel: 9 })
  .toBuffer();

writeFileSync(outPath, cleaned);

const meta = await sharp(cleaned).metadata();
console.log(
  `wrote ${outPath} (${meta.width}×${meta.height}, alpha=${meta.hasAlpha}, ${cleaned.length} bytes)`,
);
console.log(`source bg ~rgb(${bg.join(", ")}), crop ${cropWidth}×${cropHeight}`);
console.log(`recolored to Signal Blue #0057FF + Porcelain #F8F7F4`);
