export const VEHICLE_PHOTO_BUCKET = "vehicle-photos";
export const VEHICLE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const VEHICLE_PHOTO_UPLOAD_TIMEOUT_MS = 45_000;

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

const REJECTED_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

const REJECTED_EXTENSIONS = new Set(["heic", "heif", "hif"]);

export const VEHICLE_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export const VEHICLE_PHOTO_UNSUPPORTED_MESSAGE =
  "Use a JPEG, PNG, or WebP photo. iPhone HEIC photos are not supported yet.";

export const VEHICLE_PHOTO_TOO_LARGE_MESSAGE =
  "Choose a photo smaller than 5 MB.";

export const VEHICLE_PHOTO_TIMEOUT_MESSAGE =
  "Upload timed out. Try a smaller JPEG, PNG, or WebP photo.";

export async function withVehiclePhotoTimeout<T>(
  promise: Promise<T>,
  ms = VEHICLE_PHOTO_UPLOAD_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(VEHICLE_PHOTO_TIMEOUT_MESSAGE)), ms);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export type VehiclePhotoValidation =
  | { ok: true; extension: "jpg" | "png" | "webp"; contentType: string }
  | { ok: false; message: string };

function fileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? (parts.at(-1) ?? "") : "";
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

export type VehiclePhotoMagic = "jpg" | "png" | "webp" | "heic" | null;

export async function sniffVehiclePhotoMagic(
  file: File,
): Promise<VehiclePhotoMagic> {
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return "jpg";
  }
  if (
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47
  ) {
    return "png";
  }
  if (
    header.length >= 12 &&
    ascii(header, 0, 4) === "RIFF" &&
    ascii(header, 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  if (header.length >= 12 && ascii(header, 4, 8) === "ftyp") {
    return "heic";
  }
  return null;
}

export function validateVehiclePhotoFile(file: File): VehiclePhotoValidation {
  if (!(file instanceof File) || file.size <= 0) {
    return { ok: false, message: VEHICLE_PHOTO_UNSUPPORTED_MESSAGE };
  }

  if (file.size > VEHICLE_PHOTO_MAX_BYTES) {
    return { ok: false, message: VEHICLE_PHOTO_TOO_LARGE_MESSAGE };
  }

  const mime = file.type.toLowerCase();
  const extensionName = fileExtension(file.name);
  if (REJECTED_TYPES.has(mime) || REJECTED_EXTENSIONS.has(extensionName)) {
    return { ok: false, message: VEHICLE_PHOTO_UNSUPPORTED_MESSAGE };
  }

  const fromType = ALLOWED_TYPES.get(mime);
  const fromName = EXTENSION_TYPES.get(extensionName);
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

/** Size/type checks plus magic-byte sniff so mislabeled iPhone HEIC fails immediately. */
export async function validateVehiclePhotoForUpload(
  file: File,
): Promise<VehiclePhotoValidation> {
  const parsed = validateVehiclePhotoFile(file);
  if (!parsed.ok) {
    return parsed;
  }

  const magic = await sniffVehiclePhotoMagic(file);
  if (magic === "heic") {
    return { ok: false, message: VEHICLE_PHOTO_UNSUPPORTED_MESSAGE };
  }
  if (magic === "jpg" || magic === "png" || magic === "webp") {
    return {
      ok: true,
      extension: magic,
      contentType:
        magic === "png"
          ? "image/png"
          : magic === "webp"
            ? "image/webp"
            : "image/jpeg",
    };
  }

  return parsed;
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
