import { isNativeHandoffPlatform } from "@/lib/location/is-native-handoff-platform";

export const VEHICLE_PHOTO_CAMERA_PERMISSION_MESSAGE =
  "Camera permission is required to take a photo.";

export const VEHICLE_PHOTO_CAMERA_UNAVAILABLE_MESSAGE =
  "Camera is unavailable. You can still choose a photo from your library.";

export const VEHICLE_PHOTO_CAMERA_FAILED_MESSAGE =
  "Could not take a photo. Try choosing one from your library.";

export type CaptureVehiclePhotoResult =
  | { ok: true; file: File }
  | {
      ok: false;
      reason: "cancelled" | "permission" | "unavailable" | "failed" | "web-fallback";
      message?: string;
    };

type CameraPluginError = {
  code?: string;
  message?: string;
};

function pluginError(error: unknown): CameraPluginError {
  if (error && typeof error === "object") {
    const candidate = error as { code?: unknown; message?: unknown };
    return {
      code: typeof candidate.code === "string" ? candidate.code : undefined,
      message:
        typeof candidate.message === "string" ? candidate.message : undefined,
    };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return {};
}

function classifyCameraError(
  error: unknown,
): Extract<CaptureVehiclePhotoResult, { ok: false }> {
  const { code, message } = pluginError(error);
  const combined = `${code ?? ""} ${message ?? ""}`.toLowerCase();

  if (
    code === "OS-PLUG-CAMR-0006" ||
    combined.includes("cancel")
  ) {
    return { ok: false, reason: "cancelled" };
  }

  if (
    code === "OS-PLUG-CAMR-0003" ||
    combined.includes("permission")
  ) {
    return {
      ok: false,
      reason: "permission",
      message: VEHICLE_PHOTO_CAMERA_PERMISSION_MESSAGE,
    };
  }

  if (
    code === "OS-PLUG-CAMR-0007" ||
    combined.includes("no camera") ||
    combined.includes("unavailable")
  ) {
    return {
      ok: false,
      reason: "unavailable",
      message: VEHICLE_PHOTO_CAMERA_UNAVAILABLE_MESSAGE,
    };
  }

  return {
    ok: false,
    reason: "failed",
    message: VEHICLE_PHOTO_CAMERA_FAILED_MESSAGE,
  };
}

function extensionForFormat(format: string | undefined, mime: string): "jpg" | "png" | "webp" {
  const normalized = (format ?? "").toLowerCase();
  if (normalized === "png" || mime === "image/png") {
    return "png";
  }
  if (normalized === "webp" || mime === "image/webp") {
    return "webp";
  }
  return "jpg";
}

async function fileFromWebPath(
  webPath: string,
  format: string | undefined,
): Promise<File> {
  const response = await fetch(webPath);
  if (!response.ok) {
    throw new Error("Could not read captured photo.");
  }
  const blob = await response.blob();
  const mime =
    blob.type && blob.type !== "application/octet-stream"
      ? blob.type
      : format === "png"
        ? "image/png"
        : format === "webp"
          ? "image/webp"
          : "image/jpeg";
  const extension = extensionForFormat(format, mime);
  return new File([blob], `vehicle-photo.${extension}`, { type: mime });
}

/**
 * Native Capacitor camera capture for vehicle photos.
 * Web/PWA returns `web-fallback` so the caller can use a capture file input.
 */
export async function captureVehiclePhoto(): Promise<CaptureVehiclePhotoResult> {
  if (!isNativeHandoffPlatform()) {
    return { ok: false, reason: "web-fallback" };
  }

  try {
    const { Camera, CameraDirection, EncodingType } = await import(
      "@capacitor/camera"
    );
    const photo = await Camera.takePhoto({
      quality: 85,
      cameraDirection: CameraDirection.Rear,
      encodingType: EncodingType.JPEG,
      saveToGallery: false,
      correctOrientation: true,
      editable: "no",
      targetWidth: 1920,
      targetHeight: 1920,
    });

    const webPath = photo.webPath;
    if (!webPath) {
      return {
        ok: false,
        reason: "failed",
        message: VEHICLE_PHOTO_CAMERA_FAILED_MESSAGE,
      };
    }

    const file = await fileFromWebPath(webPath, photo.metadata?.format);
    return { ok: true, file };
  } catch (error) {
    return classifyCameraError(error);
  }
}
