export const VEHICLE_PHOTO_BUCKET = "vehicle-photos";
export const VEHICLE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Map<string, "jpg" | "png" | "webp">([
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const EXTENSION_TYPES = new Map<string, "jpg" | "png" | "webp">([
  ["jpg", "jpg"],
  ["jpeg", "jpg"],
  ["png", "png"],
  ["webp", "webp"],
]);

export const VEHICLE_PHOTO_ACCEPT = "image/*";

export const VEHICLE_PHOTO_UNSUPPORTED_MESSAGE =
  "Use a JPEG, PNG, or WebP photo.";

export const VEHICLE_PHOTO_TOO_LARGE_MESSAGE =
  "Choose a photo smaller than 5 MB.";

export type VehiclePhotoValidation =
  | { ok: true; extension: "jpg" | "png" | "webp"; contentType: string }
  | { ok: false; message: string };

function fileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? (parts.at(-1) ?? "") : "";
}

export function validateVehiclePhotoFile(file: File): VehiclePhotoValidation {
  if (!(file instanceof File) || file.size <= 0) {
    return { ok: false, message: VEHICLE_PHOTO_UNSUPPORTED_MESSAGE };
  }

  if (file.size > VEHICLE_PHOTO_MAX_BYTES) {
    return { ok: false, message: VEHICLE_PHOTO_TOO_LARGE_MESSAGE };
  }

  const fromType = ALLOWED_TYPES.get(file.type.toLowerCase());
  const fromName = EXTENSION_TYPES.get(fileExtension(file.name));
  const extension = fromType ?? fromName;

  if (!extension) {
    return { ok: false, message: VEHICLE_PHOTO_UNSUPPORTED_MESSAGE };
  }

  const contentType =
    extension === "png"
      ? "image/png"
      : extension === "webp"
        ? "image/webp"
        : "image/jpeg";

  return { ok: true, extension, contentType };
}

export function buildVehiclePhotoPath(
  userId: string,
  extension: "jpg" | "png" | "webp",
): string {
  return `${userId}/${crypto.randomUUID()}.${extension}`;
}

export function isOwnVehiclePhotoPath(
  userId: string,
  path: string | null | undefined,
): boolean {
  if (!path || !userId) {
    return false;
  }
  return (
    path.startsWith(`${userId}/`) &&
    !path.includes("..") &&
    path.split("/").length === 2
  );
}
