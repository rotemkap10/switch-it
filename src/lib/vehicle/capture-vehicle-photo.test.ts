import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const takePhotoMock = vi.fn();
const isNativeMock = vi.fn(() => false);

vi.mock("@/lib/location/is-native-handoff-platform", () => ({
  isNativeHandoffPlatform: () => isNativeMock(),
}));

vi.mock("@capacitor/camera", () => ({
  Camera: {
    takePhoto: (...args: unknown[]) => takePhotoMock(...args),
  },
  CameraDirection: { Rear: "REAR", Front: "FRONT" },
  EncodingType: { JPEG: 0, PNG: 1 },
}));

import {
  captureVehiclePhoto,
  VEHICLE_PHOTO_CAMERA_FAILED_MESSAGE,
  VEHICLE_PHOTO_CAMERA_PERMISSION_MESSAGE,
  VEHICLE_PHOTO_CAMERA_UNAVAILABLE_MESSAGE,
} from "@/lib/vehicle/capture-vehicle-photo";

const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

describe("captureVehiclePhoto", () => {
  beforeEach(() => {
    takePhotoMock.mockReset();
    isNativeMock.mockReturnValue(false);
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back on web without calling the native Camera API", async () => {
    isNativeMock.mockReturnValue(false);
    const result = await captureVehiclePhoto();
    expect(result).toEqual({ ok: false, reason: "web-fallback" });
    expect(takePhotoMock).not.toHaveBeenCalled();
  });

  it("opens the rear camera on Capacitor and returns a File", async () => {
    isNativeMock.mockReturnValue(true);
    takePhotoMock.mockResolvedValue({
      webPath: "https://localhost/captured.jpg",
      metadata: { format: "jpeg" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob([jpegBytes], { type: "image/jpeg" }),
      })),
    );

    const result = await captureVehiclePhoto();

    expect(takePhotoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cameraDirection: "REAR",
        saveToGallery: false,
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file).toBeInstanceOf(File);
      expect(result.file.type).toBe("image/jpeg");
      expect(result.file.name).toBe("vehicle-photo.jpg");
    }
  });

  it("treats user cancel as a silent cancellation", async () => {
    isNativeMock.mockReturnValue(true);
    takePhotoMock.mockRejectedValue({
      code: "OS-PLUG-CAMR-0006",
      message: "Couldn't take photo because the process was canceled.",
    });

    await expect(captureVehiclePhoto()).resolves.toEqual({
      ok: false,
      reason: "cancelled",
    });
  });

  it("maps camera permission denial", async () => {
    isNativeMock.mockReturnValue(true);
    takePhotoMock.mockRejectedValue({
      code: "OS-PLUG-CAMR-0003",
      message: "Couldn't access camera.",
    });

    await expect(captureVehiclePhoto()).resolves.toEqual({
      ok: false,
      reason: "permission",
      message: VEHICLE_PHOTO_CAMERA_PERMISSION_MESSAGE,
    });
  });

  it("maps a missing camera", async () => {
    isNativeMock.mockReturnValue(true);
    takePhotoMock.mockRejectedValue({
      code: "OS-PLUG-CAMR-0007",
      message: "No camera available.",
    });

    await expect(captureVehiclePhoto()).resolves.toEqual({
      ok: false,
      reason: "unavailable",
      message: VEHICLE_PHOTO_CAMERA_UNAVAILABLE_MESSAGE,
    });
  });

  it("maps a failed image read after capture", async () => {
    isNativeMock.mockReturnValue(true);
    takePhotoMock.mockResolvedValue({
      webPath: "https://localhost/captured.jpg",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        blob: async () => new Blob([]),
      })),
    );

    await expect(captureVehiclePhoto()).resolves.toEqual({
      ok: false,
      reason: "failed",
      message: VEHICLE_PHOTO_CAMERA_FAILED_MESSAGE,
    });
  });
});
