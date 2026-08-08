import { describe, expect, it } from "vitest";

import {
  buildVehiclePhotoPath,
  isOwnVehiclePhotoPath,
  validateVehiclePhotoFile,
  VEHICLE_PHOTO_MAX_BYTES,
  VEHICLE_PHOTO_TOO_LARGE_MESSAGE,
  VEHICLE_PHOTO_UNSUPPORTED_MESSAGE,
} from "@/lib/vehicle/photo";

function fakeFile(
  name: string,
  type: string,
  size = 12,
): File {
  const bytes = new Uint8Array(size);
  return new File([bytes], name, { type });
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

  it("rejects unsupported formats including HEIC", () => {
    expect(validateVehiclePhotoFile(fakeFile("car.heic", "image/heic"))).toEqual({
      ok: false,
      message: VEHICLE_PHOTO_UNSUPPORTED_MESSAGE,
    });
    expect(validateVehiclePhotoFile(fakeFile("car.gif", "image/gif"))).toEqual({
      ok: false,
      message: VEHICLE_PHOTO_UNSUPPORTED_MESSAGE,
    });
  });

  it("rejects files over 5 MB", () => {
    expect(
      validateVehiclePhotoFile(
        fakeFile("huge.jpg", "image/jpeg", VEHICLE_PHOTO_MAX_BYTES + 1),
      ),
    ).toEqual({
      ok: false,
      message: VEHICLE_PHOTO_TOO_LARGE_MESSAGE,
    });
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
