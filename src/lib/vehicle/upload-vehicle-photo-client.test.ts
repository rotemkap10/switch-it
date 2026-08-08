import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, uploadMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  uploadMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: getUserMock },
    storage: {
      from: () => ({ upload: uploadMock }),
    },
  }),
}));

import {
  VEHICLE_PHOTO_TIMEOUT_MESSAGE,
  VEHICLE_PHOTO_TOO_LARGE_MESSAGE,
  VEHICLE_PHOTO_UNSUPPORTED_MESSAGE,
} from "@/lib/vehicle/photo";
import { uploadVehiclePhotoToStorage } from "@/lib/vehicle/upload-vehicle-photo-client";

function jpegFile() {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  return new File([bytes], "car.jpg", { type: "image/jpeg" });
}

describe("uploadVehiclePhotoToStorage", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    uploadMock.mockReset();
    getUserMock.mockResolvedValue({
      data: { user: { id: "11111111-1111-4111-8111-111111111111" } },
      error: null,
    });
    uploadMock.mockResolvedValue({ error: null });
  });

  it("rejects HEIC before calling Storage", async () => {
    const heic = new File(
      [
        new Uint8Array([
          0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
        ]),
      ],
      "IMG_1000.HEIC",
      { type: "image/heic" },
    );

    await expect(uploadVehiclePhotoToStorage(heic)).resolves.toEqual({
      ok: false,
      error: VEHICLE_PHOTO_UNSUPPORTED_MESSAGE,
    });
    expect(uploadMock).not.toHaveBeenCalled();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("rejects files over 5 MB before calling Storage", async () => {
    const huge = jpegFile();
    Object.defineProperty(huge, "size", { value: 5 * 1024 * 1024 + 1 });
    await expect(uploadVehiclePhotoToStorage(huge)).resolves.toEqual({
      ok: false,
      error: VEHICLE_PHOTO_TOO_LARGE_MESSAGE,
    });
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("uploads directly to the private bucket for the signed-in user", async () => {
    const result = await uploadVehiclePhotoToStorage(jpegFile());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.photoPath).toMatch(
        /^11111111-1111-4111-8111-111111111111\/.+\.jpg$/,
      );
    }
    expect(uploadMock).toHaveBeenCalledOnce();
    expect(uploadMock.mock.calls[0]?.[2]).toMatchObject({
      contentType: "image/jpeg",
      upsert: false,
    });
  });

  it("returns a timeout message when Storage does not complete", async () => {
    uploadMock.mockImplementation(() => new Promise(() => {}));

    await expect(
      uploadVehiclePhotoToStorage(jpegFile(), { timeoutMs: 20 }),
    ).resolves.toEqual({
      ok: false,
      error: VEHICLE_PHOTO_TIMEOUT_MESSAGE,
    });
  });
});
