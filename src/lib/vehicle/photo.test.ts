import { describe, expect, it } from "vitest";

import {
  buildVehiclePhotoPath,
  isOwnVehiclePhotoPath,
  sniffVehiclePhotoMagic,
  validateVehiclePhotoFile,
  validateVehiclePhotoForUpload,
  VEHICLE_PHOTO_MAX_BYTES,
  VEHICLE_PHOTO_TIMEOUT_MESSAGE,
  VEHICLE_PHOTO_TOO_LARGE_MESSAGE,
  VEHICLE_PHOTO_UNSUPPORTED_MESSAGE,
  withVehiclePhotoTimeout,
} from "@/lib/vehicle/photo";

function fakeFile(
  name: string,
  type: string,
  size = 12,
  bytes?: Uint8Array,
): File {
  const payload = bytes ?? new Uint8Array(size);
  return new File([payload], name, { type });
}

function jpegFile(name = "car.jpg", type = "image/jpeg") {
  return fakeFile(name, type, 12, new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]));
}

function heicFile(name = "car.heic", type = "image/heic") {
  const bytes = new Uint8Array([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0,
  ]);
  return fakeFile(name, type, bytes.length, bytes);
}

describe("validateVehiclePhotoFile", () => {
  it("accepts jpeg, png, and webp", () => {
    expect(validateVehiclePhotoFile(fakeFile("car.jpg", "image/jpeg"))).toEqual({
      ok: true,
      extension: "jpg",
      contentType: "image/jpeg",
    });
    expect(validateVehiclePhotoFile(fakeFile("car.png", "image/png"))).toEqual({
      ok: true,
      extension: "png",
      contentType: "image/png",
    });
    expect(validateVehiclePhotoFile(fakeFile("car.webp", "image/webp"))).toEqual({
      ok: true,
      extension: "webp",
      contentType: "image/webp",
    });
  });

  it("falls back to the file extension when the mime type is missing", () => {
    expect(validateVehiclePhotoFile(fakeFile("car.JPEG", ""))).toEqual({
      ok: true,
      extension: "jpg",
      contentType: "image/jpeg",
    });
  });

  it("rejects unsupported formats including HEIC/HEIF immediately", () => {
    expect(validateVehiclePhotoFile(fakeFile("car.heic", "image/heic"))).toEqual({
      ok: false,
      message: VEHICLE_PHOTO_UNSUPPORTED_MESSAGE,
    });
    expect(validateVehiclePhotoFile(fakeFile("car.HEIF", "image/heif"))).toEqual({
      ok: false,
      message: VEHICLE_PHOTO_UNSUPPORTED_MESSAGE,
    });
    expect(validateVehiclePhotoFile(fakeFile("car.gif", "image/gif"))).toEqual({
      ok: false,
      message: VEHICLE_PHOTO_UNSUPPORTED_MESSAGE,
    });
  });

  it("rejects files over 5 MB before any upload", () => {
    const huge = fakeFile("huge.jpg", "image/jpeg");
    Object.defineProperty(huge, "size", { value: VEHICLE_PHOTO_MAX_BYTES + 1 });
    expect(validateVehiclePhotoFile(huge)).toEqual({
      ok: false,
      message: VEHICLE_PHOTO_TOO_LARGE_MESSAGE,
    });
  });
});

describe("validateVehiclePhotoForUpload", () => {
  it("rejects HEIC magic bytes even when the file is named like a jpeg", async () => {
    await expect(
      validateVehiclePhotoForUpload(heicFile("IMG_1234.jpg", "image/jpeg")),
    ).resolves.toEqual({
      ok: false,
      message: VEHICLE_PHOTO_UNSUPPORTED_MESSAGE,
    });
  });

  it("accepts real jpeg magic bytes", async () => {
    await expect(validateVehiclePhotoForUpload(jpegFile())).resolves.toEqual({
      ok: true,
      extension: "jpg",
      contentType: "image/jpeg",
    });
  });

  it("sniffs jpeg / heic headers", async () => {
    await expect(sniffVehiclePhotoMagic(jpegFile())).resolves.toBe("jpg");
    await expect(sniffVehiclePhotoMagic(heicFile())).resolves.toBe("heic");
  });
});

describe("withVehiclePhotoTimeout", () => {
  it("resolves when the work finishes in time", async () => {
    await expect(withVehiclePhotoTimeout(Promise.resolve("ok"), 50)).resolves.toBe(
      "ok",
    );
  });

  it("rejects with the timeout message when work never finishes", async () => {
    await expect(
      withVehiclePhotoTimeout(new Promise(() => {}), 20),
    ).rejects.toThrow(VEHICLE_PHOTO_TIMEOUT_MESSAGE);
  });
});

describe("vehicle photo paths", () => {
  it("builds a user-scoped object path", () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    const path = buildVehiclePhotoPath(userId, "jpg");
    expect(isOwnVehiclePhotoPath(userId, path)).toBe(true);
    expect(path.startsWith(`${userId}/`)).toBe(true);
    expect(path.endsWith(".jpg")).toBe(true);
  });

  it("rejects guessed or traversal paths", () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    const other = "22222222-2222-4222-8222-222222222222";
    expect(isOwnVehiclePhotoPath(userId, `${other}/photo.jpg`)).toBe(false);
    expect(isOwnVehiclePhotoPath(userId, `${userId}/../secret.jpg`)).toBe(false);
    expect(isOwnVehiclePhotoPath(userId, null)).toBe(false);
  });
});
