import type { Map as MapLibreMap } from "maplibre-gl";

import {
  MAP_INTERACTION_OPTIONS,
  isNativeAndroidCapacitor,
  resolveMapLibreReduceMotion,
  resolveMapReduceMotion,
} from "@/lib/map/maplibre-interaction";

type MapWithOptionalEasing = MapLibreMap & {
  isEasing?: () => boolean;
};

/**
 * Development-only: dump MapLibre interaction / compositing state so Find
 * Parking and Share a Spot can be compared on a real device.
 */
export function logMapInteractionSnapshot(
  label: string,
  map: MapLibreMap,
): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  try {
    const canvas = map.getCanvas();
    const canvasContainer = map.getCanvasContainer();
    const container = map.getContainer();
    const dragPan = map.dragPan as unknown as {
      isEnabled?: () => boolean;
      _inertiaOptions?: unknown;
    };
    const mapWithEasing = map as MapWithOptionalEasing;

    const ancestors: Array<Record<string, string>> = [];
    let node: HTMLElement | null = container;
    while (node && ancestors.length < 12) {
      const style = window.getComputedStyle(node);
      ancestors.push({
        tag: node.tagName.toLowerCase(),
        class: node.className?.toString?.().slice(0, 80) ?? "",
        transform: style.transform,
        filter: style.filter,
        willChange: style.willChange,
        touchAction: style.touchAction,
        overflow: `${style.overflowX}/${style.overflowY}`,
        isolation: style.isolation,
      });
      node = node.parentElement;
    }

    console.info(`[map-interaction:${label}]`, {
      nativeAndroidCapacitor: isNativeAndroidCapacitor(),
      prefersReducedMotionMedia: resolveMapReduceMotion(),
      mapLibreReduceMotion: resolveMapLibreReduceMotion(),
      constructorInteraction: MAP_INTERACTION_OPTIONS,
      dragPanEnabled: dragPan.isEnabled?.() ?? null,
      dragPanInertiaOptions: dragPan._inertiaOptions ?? null,
      touchZoomRotateEnabled: map.touchZoomRotate.isEnabled(),
      scrollZoomEnabled: map.scrollZoom.isEnabled(),
      isMoving: map.isMoving(),
      isEasing:
        typeof mapWithEasing.isEasing === "function"
          ? mapWithEasing.isEasing()
          : null,
      canvasTouchAction: window.getComputedStyle(canvas).touchAction,
      canvasContainerTouchAction:
        window.getComputedStyle(canvasContainer).touchAction,
      containerTouchAction: window.getComputedStyle(container).touchAction,
      camera: {
        zoom: map.getZoom(),
        center: map.getCenter(),
        bearing: typeof map.getBearing === "function" ? map.getBearing() : null,
        pitch: typeof map.getPitch === "function" ? map.getPitch() : null,
      },
      ancestors,
    });
  } catch (error) {
    console.warn(`[map-interaction:${label}] snapshot failed`, error);
  }
}
