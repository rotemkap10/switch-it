/**
 * Shared extraction of the square Switch It app mark from the horizontal lockup.
 * Used by app-icon generation and native/web launch splash pipelines.
 */
import sharp from "sharp";

/**
 * @param {string} logoPath
 * @returns {Promise<{
 *   markBuffer: Buffer;
 *   crop: { left: number; top: number; width: number; height: number };
 *   fillHex: string;
 *   fillRgba: { r: number; g: number; b: number; alpha: number };
 * }>}
 */
export async function extractAppMark(logoPath) {
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
  const fillHex = `#${fill.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  const markBuffer = await sharp(logoPath).extract(crop).png().toBuffer();

  return { markBuffer, crop, fillHex, fillRgba };
}

/**
 * Square app-icon tile: mark centered on the extracted cyan fill.
 *
 * @param {string} logoPath
 * @param {number} size
 * @param {{ safeZone?: number }} [options]
 */
export async function renderAppIconTile(logoPath, size, { safeZone = 1 } = {}) {
  const { markBuffer, fillRgba } = await extractAppMark(logoPath);
  const inner = Math.max(1, Math.round(size * safeZone));
  const resized = await sharp(markBuffer)
    .resize(inner, inner, { fit: "contain", background: fillRgba })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: fillRgba,
    },
  })
    .composite([{ input: resized, gravity: "centre" }])
    .png()
    .toBuffer();
}
