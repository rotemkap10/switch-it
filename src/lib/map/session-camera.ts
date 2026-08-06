/**
 * In-memory camera continuity for the current browser session.
 * Seeker and publisher cameras stay separate. Nothing is written to storage.
 */

export type SessionMapCamera = {
  center: [number, number]; // [lng, lat]
  zoom: number;
};

type MapCameraRole = "seeker" | "publisher";

const cameras: Partial<Record<MapCameraRole, SessionMapCamera>> = {};

export function readSessionMapCamera(
  role: MapCameraRole,
): SessionMapCamera | null {
  return cameras[role] ?? null;
}

export function writeSessionMapCamera(
  role: MapCameraRole,
  camera: SessionMapCamera,
): void {
  if (
    !Number.isFinite(camera.center[0]) ||
    !Number.isFinite(camera.center[1]) ||
    !Number.isFinite(camera.zoom)
  ) {
    return;
  }
  cameras[role] = {
    center: [camera.center[0], camera.center[1]],
    zoom: camera.zoom,
  };
}

/** Test helper */
export function resetSessionMapCameras(): void {
  delete cameras.seeker;
  delete cameras.publisher;
}
