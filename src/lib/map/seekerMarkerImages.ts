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
  SeekerMarkerImageId,
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
  "spot-destination": {
    ring: [46, 168, 120, 255],
    fill: [255, 255, 255, 255],
    glyph: [46, 168, 120, 255],
    size: 52,
    ringWidth: 5,
  },
  "seeker-live": {
    ring: [47, 169, 230, 255],
    fill: [85, 191, 243, 255],
    glyph: [255, 255, 255, 255],
    size: 56,
    ringWidth: 4,
  },
};

function setPixel(data: Uint8ClampedArray, i: number, rgba: Rgba) {
  data[i] = rgba[0];
  data[i + 1] = rgba[1];
  data[i + 2] = rgba[2];
  data[i + 3] = rgba[3];
}

export type SeekerMarkerImagePixels = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

/**
 * Build a circular parking / live marker as raw RGBA pixels.
 * Avoids SVG / map.loadImage — MapLibre does not reliably decode SVG for icons.
 * MapLibre accepts { width, height, data } the same as ImageData.
 */
export function createSeekerMarkerImageData(
  id: SeekerMarkerImageId,
): SeekerMarkerImagePixels {
  const spec = MARKER_COLORS[id];
  const { size, ring, fill, glyph, ringWidth } = spec;
  const data = new Uint8ClampedArray(size * size * 4);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const outerR = size / 2 - 2;
  const innerR = outerR - ringWidth;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = Math.hypot(x - cx, y - cy);
      const i = (y * size + x) * 4;
      if (d <= innerR) {
        setPixel(data, i, fill);
      } else if (d <= outerR) {
        setPixel(data, i, ring);
      }
    }
  }

  drawInnerDot(data, size, glyph, id === SEEKER_MARKER_IMAGE_IDS.seekerLive);

  return { width: size, height: size, data };
}

function fillRect(
  data: Uint8ClampedArray,
  size: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: Rgba,
) {
  const left = Math.max(0, Math.round(Math.min(x0, x1)));
  const right = Math.min(size - 1, Math.round(Math.max(x0, x1)));
  const top = Math.max(0, Math.round(Math.min(y0, y1)));
  const bottom = Math.min(size - 1, Math.round(Math.max(y0, y1)));
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      setPixel(data, (y * size + x) * 4, color);
    }
  }
}

/** Compact “P” for parking pins; a simple disc for the live seeker puck. */
function drawInnerDot(
  data: Uint8ClampedArray,
  size: number,
  color: Rgba,
  discOnly: boolean,
) {
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;

  if (discOnly) {
    const radius = size * 0.16;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (Math.hypot(x - cx, y - cy) <= radius) {
          setPixel(data, (y * size + x) * 4, color);
        }
      }
    }
    return;
  }

  drawParkingP(data, size, color);
}

function drawParkingP(
  data: Uint8ClampedArray,
  size: number,
  color: Rgba,
) {
  const stemLeft = size * 0.33;
  const stemRight = size * 0.46;
  const top = size * 0.27;
  const bottom = size * 0.73;
  fillRect(data, size, stemLeft, top, stemRight, bottom, color);

  const bowlCx = stemRight + size * 0.01;
  const bowlCy = top + size * 0.22;
  const outerR = size * 0.2;
  const innerR = size * 0.07;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (x < bowlCx) {
        continue;
      }
      const d = Math.hypot(x - bowlCx, y - bowlCy);
      if (d <= outerR && d >= innerR) {
        setPixel(data, (y * size + x) * 4, color);
      }
    }
  }

  fillRect(data, size, stemRight - 1, top, bowlCx + 1, top + size * 0.13, color);
  fillRect(
    data,
    size,
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
