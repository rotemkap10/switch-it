import type { Map as MapLibreMap } from "maplibre-gl";

import { isNativeHandoffPlatform } from "@/lib/location/is-native-handoff-platform";

/**
 * Shared MapLibre constructor interaction flags for Switch It maps.
 * Initialized ONCE in BaseMap — Find Parking and Share a Spot must not
 * re-enable / reconfigure dragPan after construction (except BaseMap's own
 * explicit enable with the same options after construct).
 *
 * Values match MapLibre's defaultPanInertiaOptions
 * (handler_inertia in maplibre-gl @6.x).
 *
 * MapLibre skips inertial easeTo when browser.prefersReducedMotion is true.
 * BaseMap sets reduceMotion from the real media query so Android animator
 * developer options / false positives can be diagnosed; do not invent custom
 * deceleration constants unless device QA proves defaults insufficient.
 */
export const MAP_DRAG_PAN_INERTIA_OPTIONS = {
  linearity: 0.3,
  deceleration: 2500,
  maxSpeed: 1400,
} as const;

export const MAP_INTERACTION_OPTIONS = {
  dragPan: MAP_DRAG_PAN_INERTIA_OPTIONS,
  dragRotate: false,
  touchPitch: false,
  pitchWithRotate: false,
  maxPitch: 0,
} as const;

/** True while a user drag or MapLibre ease/inertia is in progress. */
export function isMapCameraBusy(map: MapLibreMap): boolean {
  if (typeof map.isMoving === "function" && map.isMoving()) {
    return true;
  }
  const maybeEasing = map as MapLibreMap & { isEasing?: () => boolean };
  if (typeof maybeEasing.isEasing === "function" && maybeEasing.isEasing()) {
    return true;
  }
  return false;
}

/**
 * Whether MapLibre should honor prefers-reduced-motion for gesture inertia.
 * Keep a11y: when the user asks to reduce motion, disable fling inertia.
 */
export function resolveMapReduceMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function getCapacitorPlatform(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const capacitor = (
    window as unknown as {
      Capacitor?: { getPlatform?: () => string };
    }
  ).Capacitor;
  try {
    return typeof capacitor?.getPlatform === "function"
      ? capacitor.getPlatform()
      : null;
  } catch {
    return null;
  }
}

/** Capacitor Android shell — distinct from Safari / Chrome for gesture tuning. */
export function isNativeAndroidCapacitor(): boolean {
  return isNativeHandoffPlatform() && getCapacitorPlatform() === "android";
}

/**
 * MapLibre constructor reduceMotion flag.
 *
 * Android Capacitor WebView often reports `prefers-reduced-motion: reduce` when
 * the system animator duration scale is 0, which disables MapLibre pan fling
 * entirely. iPhone WebView does not share this false positive — keep inertia
 * enabled on native Android while still honoring real reduced-motion elsewhere.
 */
export function resolveMapLibreReduceMotion(): boolean {
  if (isNativeAndroidCapacitor()) {
    return false;
  }
  return resolveMapReduceMotion();
}

/** Re-assert shared pan inertia after construct or handler re-enable. */
export function applyMapDragPanInertia(map: MapLibreMap): void {
  if (resolveMapLibreReduceMotion()) {
    return;
  }
  map.dragPan.enable({ ...MAP_DRAG_PAN_INERTIA_OPTIONS });
}
