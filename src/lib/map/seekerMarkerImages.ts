import type { Map as MapLibreMap } from "maplibre-gl";

/** Stable MapLibre image IDs used by seeker symbol layers. */
export const SEEKER_MARKER_IMAGE_IDS = {
  unselected: "spot-unselected",
  selected: "spot-selected",
  destination: "spot-destination",
  seekerLive: "seeker-live",
} as const;

export type SeekerMarkerImageId =
  (typeof SEEKER_MARKER_IMAGE_IDS)[keyof typeof SEEKER_MARKER_IMAGE_IDS];

export const SEEKER_MARKER_IMAGE_ID_LIST: readonly SeekerMarkerImageId[] = [
  SEEKER_MARKER_IMAGE_IDS.unselected,
  SEEKER_MARKER_IMAGE_IDS.selected,
  SEEKER_MARKER_IMAGE_IDS.destination,
  SEEKER_MARKER_IMAGE_IDS.seekerLive,
];

type Rgba = readonly [number, number, number, number];

const MARKER_COLORS: Record<
  "spot-unselected" | "spot-selected",
  { ring: Rgba; fill: Rgba; glyph: Rgba; size: number; ringWidth: number }
> = {
  // Slightly stronger saturation so markers stay prominent on pastel basemaps.
  "spot-unselected": {
    ring: [37, 168, 230, 255],
    fill: [255, 255, 255, 255],
    glyph: [37, 168, 230, 255],
    size: 52,
    ringWidth: 5,
  },
  "spot-selected": {
    ring: [14, 132, 204, 255],
    fill: [255, 255, 255, 255],
    glyph: [14, 132, 204, 255],
    size: 62,
    ringWidth: 6,
  },
};

const PIN_SHADOW: Rgba = [18, 42, 72, 72];
const PIN_OUTLINE: Rgba = [14, 78, 128, 255];
const PIN_FILL: Rgba = [37, 168, 230, 255];
const PIN_GLYPH: Rgba = [255, 255, 255, 255];

const CAR_SHADOW: Rgba = [18, 42, 72, 70];
const CAR_OUTLINE: Rgba = [16, 64, 104, 255];
const CAR_BODY: Rgba = [37, 168, 230, 255];
const CAR_BODY_DARK: Rgba = [22, 124, 188, 255];
const CAR_HOOD: Rgba = [72, 186, 236, 255];
const CAR_WINDOW: Rgba = [232, 245, 255, 255];
const CAR_WHEEL: Rgba = [32, 42, 56, 255];
const CAR_LIGHT: Rgba = [255, 240, 190, 255];
const CAR_MIRROR: Rgba = [20, 112, 176, 255];

function setPixel(data: Uint8ClampedArray, i: number, rgba: Rgba) {
  data[i] = rgba[0];
  data[i + 1] = rgba[1];
  data[i + 2] = rgba[2];
  data[i + 3] = rgba[3];
}

function blendPixel(
  data: Uint8ClampedArray,
  i: number,
  rgba: Rgba,
  alpha: number,
) {
  const a = Math.max(0, Math.min(1, alpha)) * (rgba[3] / 255);
  if (a <= 0) {
    return;
  }
  const inv = 1 - a;
  const dstA = (data[i + 3] ?? 0) / 255;
  const outA = a + dstA * inv;
  if (outA <= 0) {
    return;
  }
  data[i] = Math.round((rgba[0] * a + (data[i] ?? 0) * inv * dstA) / outA);
  data[i + 1] = Math.round((rgba[1] * a + (data[i + 1] ?? 0) * inv * dstA) / outA);
  data[i + 2] = Math.round((rgba[2] * a + (data[i + 2] ?? 0) * inv * dstA) / outA);
  data[i + 3] = Math.round(outA * 255);
}

export type SeekerMarkerImagePixels = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

/**
 * Build parking / live markers as raw RGBA pixels.
 * Avoids SVG / map.loadImage — MapLibre does not reliably decode SVG for icons.
 * MapLibre accepts { width, height, data } the same as ImageData.
 */
export function createSeekerMarkerImageData(
  id: SeekerMarkerImageId,
): SeekerMarkerImagePixels {
  if (id === SEEKER_MARKER_IMAGE_IDS.seekerLive) {
    return createLiveCarMarker();
  }
  if (id === SEEKER_MARKER_IMAGE_IDS.destination) {
    return createParkingPinMarker();
  }
  return createCircularParkingMarker(id);
}

function createCircularParkingMarker(
  id: "spot-unselected" | "spot-selected",
): SeekerMarkerImagePixels {
  const spec = MARKER_COLORS[id];
  const { size, ring, fill, glyph, ringWidth } = spec;
  const data = new Uint8ClampedArray(size * size * 4);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const outerR = size / 2 - 2;
  const innerR = outerR - ringWidth;

  fillDisc(data, size, size, cx, cy, outerR, ring);
  fillDisc(data, size, size, cx, cy, innerR, fill);
  drawParkingP(
    data,
    size,
    size,
    glyph,
    size * 0.3,
    size * 0.27,
    size * 0.72,
    size * 0.73,
  );

  return { width: size, height: size, data };
}

/** Classic blue map pin with a white “P” — parking destination. */
function createParkingPinMarker(): SeekerMarkerImagePixels {
  const width = 104;
  const height = 144;
  const data = new Uint8ClampedArray(width * height * 4);
  const cx = (width - 1) / 2;
  const tipY = height - 4;
  const headCy = height * 0.36;
  const headR = width * 0.34;

  drawTeardropPin(
    data,
    width,
    height,
    cx + 3.2,
    headCy + 4.8,
    tipY + 2,
    headR + 0.8,
    PIN_SHADOW,
    true,
  );
  drawTeardropPin(
    data,
    width,
    height,
    cx,
    headCy,
    tipY,
    headR + 2.7,
    PIN_OUTLINE,
    false,
  );
  drawTeardropPin(
    data,
    width,
    height,
    cx,
    headCy,
    tipY - 2.4,
    headR - 1.2,
    PIN_FILL,
    false,
  );

  drawParkingP(
    data,
    width,
    height,
    PIN_GLYPH,
    cx - width * 0.175,
    headCy - headR * 0.46,
    cx + width * 0.22,
    headCy + headR * 0.5,
  );

  return { width, height, data };
}

function drawTeardropPin(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  headCy: number,
  tipY: number,
  headR: number,
  color: Rgba,
  blend: boolean,
) {
  const stemHalf = headR * 0.72;
  fillDisc(data, width, height, cx, headCy, headR, color);
  if (blend) {
    fillTriangleBlended(
      data,
      width,
      height,
      cx - stemHalf,
      headCy + headR * 0.28,
      cx + stemHalf,
      headCy + headR * 0.28,
      cx,
      tipY,
      color,
    );
    return;
  }
  fillTriangle(
    data,
    width,
    height,
    cx - stemHalf,
    headCy + headR * 0.28,
    cx + stemHalf,
    headCy + headR * 0.28,
    cx,
    tipY,
    color,
  );
}

/** Top-down modern sedan — live arriving driver. */
function createLiveCarMarker(): SeekerMarkerImagePixels {
  const width = 112;
  const height = 136;
  const data = new Uint8ClampedArray(width * height * 4);

  const left = 34;
  const right = 78;
  const top = 14;
  const bottom = 118;

  fillRoundedRectBlended(
    data,
    width,
    height,
    left + 5,
    top + 8,
    right + 5,
    bottom + 8,
    12,
    CAR_SHADOW,
  );

  fillRoundedRect(
    data,
    width,
    height,
    left - 3,
    top - 2,
    right + 3,
    bottom + 2,
    13,
    CAR_OUTLINE,
  );
  fillRoundedRect(data, width, height, left, top, right, bottom, 11, CAR_BODY);

  fillTrapezoid(
    data,
    width,
    height,
    left + 8,
    top + 2,
    right - 8,
    top + 2,
    right - 1,
    top + 22,
    left + 1,
    top + 22,
    CAR_HOOD,
  );
  fillRoundedRect(
    data,
    width,
    height,
    left + 2,
    height * 0.54,
    right - 2,
    bottom - 2,
    8,
    CAR_BODY_DARK,
  );

  fillTrapezoid(
    data,
    width,
    height,
    left + 12,
    top + 24,
    right - 12,
    top + 24,
    right - 6,
    top + 54,
    left + 6,
    top + 54,
    CAR_WINDOW,
  );
  fillRoundedRect(
    data,
    width,
    height,
    left + 8,
    top + 52,
    right - 8,
    top + 74,
    4,
    CAR_BODY_DARK,
  );
  fillTrapezoid(
    data,
    width,
    height,
    left + 8,
    top + 76,
    right - 8,
    top + 76,
    right - 13,
    top + 92,
    left + 13,
    top + 92,
    CAR_WINDOW,
  );

  fillEllipse(data, width, height, left + 2, top + 38, 6.2, 10, CAR_WHEEL);
  fillEllipse(data, width, height, right - 2, top + 38, 6.2, 10, CAR_WHEEL);
  fillEllipse(data, width, height, left + 2, bottom - 28, 6.2, 10, CAR_WHEEL);
  fillEllipse(data, width, height, right - 2, bottom - 28, 6.2, 10, CAR_WHEEL);

  fillRoundedRect(
    data,
    width,
    height,
    left - 8,
    top + 40,
    left + 1,
    top + 50,
    2.5,
    CAR_MIRROR,
  );
  fillRoundedRect(
    data,
    width,
    height,
    right - 1,
    top + 40,
    right + 8,
    top + 50,
    2.5,
    CAR_MIRROR,
  );

  fillRoundedRect(
    data,
    width,
    height,
    left + 8,
    top + 3,
    left + 17,
    top + 10,
    2,
    CAR_LIGHT,
  );
  fillRoundedRect(
    data,
    width,
    height,
    right - 17,
    top + 3,
    right - 8,
    top + 10,
    2,
    CAR_LIGHT,
  );

  return { width, height, data };
}

function fillDisc(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  color: Rgba,
) {
  const minX = Math.max(0, Math.floor(cx - radius - 1));
  const maxX = Math.min(width - 1, Math.ceil(cx + radius + 1));
  const minY = Math.max(0, Math.floor(cy - radius - 1));
  const maxY = Math.min(height - 1, Math.ceil(cy + radius + 1));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const d = Math.hypot(x - cx, y - cy);
      const alpha = Math.max(0, Math.min(1, radius - d + 0.5));
      if (alpha > 0) {
        blendPixel(data, (y * width + x) * 4, color, alpha);
      }
    }
  }
}

function fillTriangle(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  color: Rgba,
) {
  fillTriangleInternal(data, width, height, x1, y1, x2, y2, x3, y3, color, false);
}

function fillTriangleBlended(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  color: Rgba,
) {
  fillTriangleInternal(data, width, height, x1, y1, x2, y2, x3, y3, color, true);
}

function fillTriangleInternal(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  color: Rgba,
  blend: boolean,
) {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2, x3)));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(x1, x2, x3)));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2, y3)));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(y1, y2, y3)));
  const area = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);
  if (area === 0) {
    return;
  }
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const w1 = ((x2 - x) * (y3 - y) - (x3 - x) * (y2 - y)) / area;
      const w2 = ((x3 - x) * (y1 - y) - (x1 - x) * (y3 - y)) / area;
      const w3 = 1 - w1 - w2;
      if (w1 >= 0 && w2 >= 0 && w3 >= 0) {
        const i = (y * width + x) * 4;
        if (blend) {
          blendPixel(data, i, color, 1);
        } else {
          setPixel(data, i, color);
        }
      }
    }
  }
}

function fillTrapezoid(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  color: Rgba,
) {
  fillTriangle(data, width, height, x0, y0, x1, y1, x2, y2, color);
  fillTriangle(data, width, height, x0, y0, x2, y2, x3, y3, color);
}

function fillEllipse(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: Rgba,
) {
  const minX = Math.max(0, Math.floor(cx - rx - 1));
  const maxX = Math.min(width - 1, Math.ceil(cx + rx + 1));
  const minY = Math.max(0, Math.floor(cy - ry - 1));
  const maxY = Math.min(height - 1, Math.ceil(cy + ry + 1));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      const alpha = Math.max(0, Math.min(1, 1 - d + 0.35 / Math.max(rx, ry)));
      if (alpha > 0) {
        blendPixel(data, (y * width + x) * 4, color, alpha);
      }
    }
  }
}

function fillRoundedRect(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  color: Rgba,
) {
  fillRoundedRectInternal(data, width, height, x0, y0, x1, y1, radius, color, false);
}

function fillRoundedRectBlended(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  color: Rgba,
) {
  fillRoundedRectInternal(data, width, height, x0, y0, x1, y1, radius, color, true);
}

function fillRoundedRectInternal(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  color: Rgba,
  blend: boolean,
) {
  const left = Math.min(x0, x1);
  const right = Math.max(x0, x1);
  const top = Math.min(y0, y1);
  const bottom = Math.max(y0, y1);
  const r = Math.max(0, Math.min(radius, (right - left) / 2, (bottom - top) / 2));
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const hw = (right - left) / 2;
  const hh = (bottom - top) / 2;
  const minX = Math.max(0, Math.floor(left - 1));
  const maxX = Math.min(width - 1, Math.ceil(right + 1));
  const minY = Math.max(0, Math.floor(top - 1));
  const maxY = Math.min(height - 1, Math.ceil(bottom + 1));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = Math.abs(x + 0.5 - cx) - (hw - r);
      const dy = Math.abs(y + 0.5 - cy) - (hh - r);
      const sd =
        Math.min(Math.max(dx, dy), 0) +
        Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) -
        r;
      const alpha = Math.max(0, Math.min(1, 0.5 - sd));
      if (alpha <= 0) {
        continue;
      }
      const i = (y * width + x) * 4;
      if (blend || alpha < 1) {
        blendPixel(data, i, color, alpha);
      } else {
        setPixel(data, i, color);
      }
    }
  }
}

function fillRect(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: Rgba,
) {
  const left = Math.max(0, Math.round(Math.min(x0, x1)));
  const right = Math.min(width - 1, Math.round(Math.max(x0, x1)));
  const top = Math.max(0, Math.round(Math.min(y0, y1)));
  const bottom = Math.min(height - 1, Math.round(Math.max(y0, y1)));
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      setPixel(data, (y * width + x) * 4, color);
    }
  }
}

/** Compact “P” glyph, scaled into an optional box. */
function drawParkingP(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  color: Rgba,
  boxLeft: number,
  boxTop: number,
  boxRight: number,
  boxBottom: number,
) {
  const bw = boxRight - boxLeft;
  const bh = boxBottom - boxTop;
  const stemLeft = boxLeft + bw * 0.08;
  const stemRight = boxLeft + bw * 0.38;
  fillRect(data, width, height, stemLeft, boxTop, stemRight, boxBottom, color);

  const bowlCx = stemRight + bw * 0.02;
  const bowlCy = boxTop + bh * 0.38;
  const outerR = bw * 0.42;
  const innerR = bw * 0.16;

  for (let y = Math.max(0, Math.floor(boxTop)); y <= Math.min(height - 1, Math.ceil(boxBottom)); y += 1) {
    for (let x = Math.max(0, Math.floor(bowlCx)); x <= Math.min(width - 1, Math.ceil(boxRight)); x += 1) {
      const d = Math.hypot(x - bowlCx, y - bowlCy);
      if (d <= outerR && d >= innerR) {
        setPixel(data, (y * width + x) * 4, color);
      }
    }
  }

  fillRect(
    data,
    width,
    height,
    stemRight - 1,
    boxTop,
    bowlCx + 1,
    boxTop + bh * 0.22,
    color,
  );
  fillRect(
    data,
    width,
    height,
    stemRight - 1,
    bowlCy + innerR - 1,
    bowlCx + 1,
    bowlCy + outerR,
    color,
  );
}

/**
 * Register all seeker marker images. Safe to call more than once.
 * Must run after style load and before any symbol layer that references them.
 */
export function registerSeekerMarkerImages(map: MapLibreMap): void {
  for (const id of SEEKER_MARKER_IMAGE_ID_LIST) {
    if (map.hasImage(id)) {
      continue;
    }
    map.addImage(id, createSeekerMarkerImageData(id), {
      pixelRatio:
        id === SEEKER_MARKER_IMAGE_IDS.seekerLive ||
        id === SEEKER_MARKER_IMAGE_IDS.destination
          ? 3
          : 2,
      sdf: false,
    });
  }

  for (const id of SEEKER_MARKER_IMAGE_ID_LIST) {
    if (!map.hasImage(id)) {
      throw new Error(`Seeker marker image failed to register: ${id}`);
    }
  }
}

/** icon-image expression: selected → spot-selected, else spot-unselected. Never empty. */
export const SPOTS_ICON_IMAGE_EXPRESSION: [
  "case",
  ["boolean", ["get", "selected"], false],
  "spot-selected",
  "spot-unselected",
] = [
  "case",
  ["boolean", ["get", "selected"], false],
  SEEKER_MARKER_IMAGE_IDS.selected,
  SEEKER_MARKER_IMAGE_IDS.unselected,
];
