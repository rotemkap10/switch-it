import type { Map as MapLibreMap } from "maplibre-gl";

/** Stable MapLibre image IDs used by seeker symbol layers. */
export const SEEKER_MARKER_IMAGE_IDS = {
  unselected: "spot-unselected",
  selected: "spot-selected",
  destination: "spot-destination",
} as const;

export type SeekerMarkerImageId =
  (typeof SEEKER_MARKER_IMAGE_IDS)[keyof typeof SEEKER_MARKER_IMAGE_IDS];

export const SEEKER_MARKER_IMAGE_ID_LIST: readonly SeekerMarkerImageId[] = [
  SEEKER_MARKER_IMAGE_IDS.unselected,
  SEEKER_MARKER_IMAGE_IDS.selected,
  SEEKER_MARKER_IMAGE_IDS.destination,
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
 * Build a simple circular parking marker as raw RGBA pixels.
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

  // Compact "P" glyph in the center (destination uses a pin-like stem).
  if (id === SEEKER_MARKER_IMAGE_IDS.destination) {
    drawDestinationGlyph(data, size, glyph);
  } else {
    drawParkingGlyph(data, size, glyph);
  }

  return { width: size, height: size, data };
}

function drawParkingGlyph(
  data: Uint8ClampedArray,
  size: number,
  color: Rgba,
) {
  const left = Math.round(size * 0.38);
  const top = Math.round(size * 0.30);
  const stemW = Math.max(2, Math.round(size * 0.08));
  const bowlH = Math.round(size * 0.28);
  const bowlW = Math.round(size * 0.22);
  const totalH = Math.round(size * 0.42);

  for (let y = top; y < top + totalH; y += 1) {
    for (let x = left; x < left + stemW; x += 1) {
      setPixel(data, (y * size + x) * 4, color);
    }
  }
  for (let y = top; y < top + stemW; y += 1) {
    for (let x = left; x < left + bowlW; x += 1) {
      setPixel(data, (y * size + x) * 4, color);
    }
  }
  for (let y = top + bowlH; y < top + bowlH + stemW; y += 1) {
    for (let x = left; x < left + bowlW; x += 1) {
      setPixel(data, (y * size + x) * 4, color);
    }
  }
  for (let y = top; y < top + bowlH + stemW; y += 1) {
    for (let x = left + bowlW - stemW; x < left + bowlW; x += 1) {
      setPixel(data, (y * size + x) * 4, color);
    }
  }
}

function drawDestinationGlyph(
  data: Uint8ClampedArray,
  size: number,
  color: Rgba,
) {
  const cx = Math.round(size / 2);
  const top = Math.round(size * 0.30);
  const bottom = Math.round(size * 0.70);
  const halfTop = Math.round(size * 0.12);

  for (let y = top; y <= bottom; y += 1) {
    const t = (y - top) / Math.max(1, bottom - top);
    const half = Math.max(1, Math.round(halfTop * (1 - t * 0.85)));
    for (let x = cx - half; x <= cx + half; x += 1) {
      setPixel(data, (y * size + x) * 4, color);
    }
  }
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
