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

const PIN_OUTLINE: Rgba = [24, 96, 68, 255];
const PIN_FILL: Rgba = [46, 168, 120, 255];
const PIN_HIGHLIGHT: Rgba = [79, 191, 143, 255];
const PIN_GLYPH: Rgba = [255, 255, 255, 255];
const PIN_HALO: Rgba = [255, 255, 255, 230];

const CAR_HALO: Rgba = [255, 255, 255, 235];
const CAR_OUTLINE: Rgba = [18, 70, 112, 255];
const CAR_BODY: Rgba = [37, 168, 230, 255];
const CAR_BODY_DARK: Rgba = [20, 132, 196, 255];
const CAR_WINDOW: Rgba = [230, 244, 255, 255];
const CAR_WHEEL: Rgba = [30, 42, 58, 255];
const CAR_LIGHT: Rgba = [255, 236, 170, 255];

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

/** Green map pin with a white “P” — fixed parking destination. */
function createParkingPinMarker(): SeekerMarkerImagePixels {
  const width = 56;
  const height = 72;
  const data = new Uint8ClampedArray(width * height * 4);
  const cx = (width - 1) / 2;
  const tipY = height - 3;
  const headCy = height * 0.38;
  const headR = width * 0.32;

  fillDisc(data, width, height, cx, headCy, headR + 3, PIN_HALO);
  fillTriangle(
    data,
    width,
    height,
    cx - 4,
    tipY,
    cx + 4,
    tipY,
    cx,
    headCy + headR * 0.2,
    PIN_HALO,
  );

  fillDisc(data, width, height, cx, headCy, headR + 1.2, PIN_OUTLINE);
  fillTriangle(
    data,
    width,
    height,
    cx - 1.5,
    tipY,
    cx + 1.5,
    tipY,
    cx,
    headCy,
    PIN_OUTLINE,
  );

  fillDisc(data, width, height, cx, headCy, headR - 1, PIN_FILL);
  fillTriangle(
    data,
    width,
    height,
    cx - width * 0.18,
    headCy + headR * 0.35,
    cx + width * 0.18,
    headCy + headR * 0.35,
    cx,
    tipY - 1,
    PIN_FILL,
  );

  fillDisc(
    data,
    width,
    height,
    cx - headR * 0.28,
    headCy - headR * 0.32,
    headR * 0.28,
    PIN_HIGHLIGHT,
  );

  drawParkingP(
    data,
    width,
    height,
    PIN_GLYPH,
    cx - width * 0.16,
    headCy - headR * 0.42,
    cx + width * 0.2,
    headCy + headR * 0.46,
  );

  return { width, height, data };
}

/** Top-down cyan car with a thin halo — live seeker vehicle. */
function createLiveCarMarker(): SeekerMarkerImagePixels {
  const size = 52;
  const data = new Uint8ClampedArray(size * size * 4);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;

  fillDisc(data, size, size, cx, cy, size * 0.46, CAR_HALO);

  const bodyLeft = size * 0.3;
  const bodyRight = size * 0.7;
  const bodyTop = size * 0.18;
  const bodyBottom = size * 0.82;

  fillRoundedRect(
    data,
    size,
    size,
    bodyLeft - 2,
    bodyTop - 2,
    bodyRight + 2,
    bodyBottom + 2,
    7,
    CAR_OUTLINE,
  );
  fillRoundedRect(
    data,
    size,
    size,
    bodyLeft,
    bodyTop,
    bodyRight,
    bodyBottom,
    6,
    CAR_BODY,
  );
  fillRoundedRect(
    data,
    size,
    size,
    bodyLeft + 1,
    size * 0.5,
    bodyRight - 1,
    bodyBottom - 1,
    5,
    CAR_BODY_DARK,
  );

  fillRoundedRect(
    data,
    size,
    size,
    size * 0.36,
    size * 0.26,
    size * 0.64,
    size * 0.52,
    3,
    CAR_WINDOW,
  );
  fillRoundedRect(
    data,
    size,
    size,
    size * 0.38,
    size * 0.58,
    size * 0.62,
    size * 0.72,
    2,
    CAR_WINDOW,
  );

  fillRoundedRect(
    data,
    size,
    size,
    size * 0.2,
    size * 0.3,
    size * 0.3,
    size * 0.42,
    2,
    CAR_WHEEL,
  );
  fillRoundedRect(
    data,
    size,
    size,
    size * 0.7,
    size * 0.3,
    size * 0.8,
    size * 0.42,
    2,
    CAR_WHEEL,
  );
  fillRoundedRect(
    data,
    size,
    size,
    size * 0.2,
    size * 0.58,
    size * 0.3,
    size * 0.7,
    2,
    CAR_WHEEL,
  );
  fillRoundedRect(
    data,
    size,
    size,
    size * 0.7,
    size * 0.58,
    size * 0.8,
    size * 0.7,
    2,
    CAR_WHEEL,
  );

  fillRoundedRect(
    data,
    size,
    size,
    size * 0.34,
    size * 0.2,
    size * 0.42,
    size * 0.26,
    1,
    CAR_LIGHT,
  );
  fillRoundedRect(
    data,
    size,
    size,
    size * 0.58,
    size * 0.2,
    size * 0.66,
    size * 0.26,
    1,
    CAR_LIGHT,
  );

  return { width: size, height: size, data };
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
        setPixel(data, (y * width + x) * 4, color);
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
  const left = Math.min(x0, x1);
  const right = Math.max(x0, x1);
  const top = Math.min(y0, y1);
  const bottom = Math.max(y0, y1);
  const r = Math.max(0, Math.min(radius, (right - left) / 2, (bottom - top) / 2));
  const minX = Math.max(0, Math.floor(left));
  const maxX = Math.min(width - 1, Math.ceil(right));
  const minY = Math.max(0, Math.floor(top));
  const maxY = Math.min(height - 1, Math.ceil(bottom));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const cx = Math.max(left + r, Math.min(x, right - r));
      const cy = Math.max(top + r, Math.min(y, bottom - r));
      const inBody =
        x >= left + r && x <= right - r && y >= top && y <= bottom
          ? true
          : x >= left && x <= right && y >= top + r && y <= bottom - r
            ? true
            : Math.hypot(x - cx, y - cy) <= r + 0.35;
      if (inBody) {
        setPixel(data, (y * width + x) * 4, color);
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
      pixelRatio: 2,
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
