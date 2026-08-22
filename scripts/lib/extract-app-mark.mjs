/**
 * Shared extraction of the square Switch It app mark from the horizontal lockup.
 * App-icon generation uses the full tile; launch/splash uses a transparent symbol only.
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

/** True for white / near-white symbol artwork pixels. */
function isSymbolPixel(r, g, b) {
  return r > 200 && g > 200 && b > 200;
}

/** True for the rounded-square icon fill and its anti-aliased edge. */
function isTileBackgroundPixel(r, g, b, a) {
  if (a < 20) {
    return false;
  }
  if (isSymbolPixel(r, g, b)) {
    return false;
  }
  return b > 130 && g > 100 && r < 200 && b >= g - 5;
}

/**
 * Remove the app-icon tile background from the cropped mark, leaving only the
 * Switch It symbol on transparency. Geometry is unchanged — only pixels are keyed out.
 *
 * @param {Buffer} markBuffer
 */
export async function stripIconTileBackground(markBuffer) {
  const { data, info } = await sharp(markBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.from(data);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (isTileBackgroundPixel(r, g, b, a)) {
        out[i] = 0;
        out[i + 1] = 0;
        out[i + 2] = 0;
        out[i + 3] = 0;
      }
    }
  }

  return sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim()
    .png()
    .toBuffer();
}

/**
 * Transparent standalone launch mark (symbol only, no tile, no wordmark).
 *
 * @param {string} logoPath
 * @param {number} [maxDimension=1024]
 */
export async function loadStandaloneLaunchMark(logoPath, maxDimension = 1024) {
  const { markBuffer } = await extractAppMark(logoPath);
  let buffer = await stripIconTileBackground(markBuffer);
  const meta = await sharp(buffer).metadata();
  const longest = Math.max(meta.width ?? 1, meta.height ?? 1);

  if (longest > maxDimension) {
    buffer = await sharp(buffer)
      .resize({
        width: meta.width >= meta.height ? maxDimension : undefined,
        height: meta.height > meta.width ? maxDimension : undefined,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
  }

  const sized = await sharp(buffer).metadata();
  return {
    buffer,
    width: sized.width ?? 1,
    height: sized.height ?? 1,
  };
}

/**
 * Square app-icon tile: mark centered on the extracted cyan fill.
 * Used for Home Screen / launcher icons only — not launch splash.
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

/**
 * Full-screen splash composite: #dff4ff + centered transparent launch mark.
 *
 * @param {string} logoPath
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @param {number} markRatio fraction of shorter side for mark max dimension
 * @param {string} background
 */
export async function renderLaunchMarkSplash(
  logoPath,
  canvasWidth,
  canvasHeight,
  markRatio,
  background = "#dff4ff",
) {
  const markMax = Math.round(Math.min(canvasWidth, canvasHeight) * markRatio);
  const { buffer, width, height } = await loadStandaloneLaunchMark(logoPath);
  const scale = markMax / Math.max(width, height);
  const resized = await sharp(buffer)
    .resize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)), {
      fit: "inside",
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background,
    },
  })
    .composite([{ input: resized, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}
