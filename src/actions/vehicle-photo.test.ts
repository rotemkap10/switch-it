import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireUserMock,
  createSignedUrlMock,
  fromMock,
  updateMock,
  selectMock,
  eqMock,
  maybeSingleMock,
  storageRemoveMock,
} = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  createSignedUrlMock: vi.fn(),
  fromMock: vi.fn(),
  updateMock: vi.fn(),
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  storageRemoveMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  unstable_rethrow: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/vehicle/signed-photo-url", () => ({
  createVehiclePhotoSignedUrl: createSignedUrlMock,
}));

import { saveVehiclePhotoPath } from "@/actions/vehicle-photo";
import { VEHICLE_PHOTO_UNSUPPORTED_MESSAGE } from "@/lib/vehicle/photo";

const userId = "11111111-1111-4111-8111-111111111111";

describe("saveVehiclePhotoPath", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    createSignedUrlMock.mockReset();
    fromMock.mockReset();
    updateMock.mockReset();
    selectMock.mockReset();
    eqMock.mockReset();
    maybeSingleMock.mockReset();
    storageRemoveMock.mockReset();

    maybeSingleMock.mockResolvedValue({ data: { vehicle_photo_path: null } });
    eqMock.mockReturnValue({ maybeSingle: maybeSingleMock, eq: eqMock });
    selectMock.mockReturnValue({ eq: eqMock });
    updateMock.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return { select: selectMock, update: updateMock };
      }
      return { remove: storageRemoveMock };
    });
    requireUserMock.mockResolvedValue({
      user: { id: userId },
      supabase: {
        from: fromMock,
        storage: { from: () => ({ remove: storageRemoveMock }) },
      },
    });
    createSignedUrlMock.mockResolvedValue("https://example.test/signed.jpg");
  });

  it("saves an owned storage path and returns a signed URL", async () => {
    const path = `${userId}/photo.jpg`;
    const result = await saveVehiclePhotoPath(path);

    expect(result).toEqual({
      success: true,
      photoPath: path,
      photoUrl: "https://example.test/signed.jpg",
    });
    expect(createSignedUrlMock).toHaveBeenCalledWith(expect.anything(), path);
  });

  it("rejects another user's storage path without updating the profile", async () => {
    const result = await saveVehiclePhotoPath(
      "22222222-2222-4222-8222-222222222222/photo.jpg",
    );

    expect(result).toEqual({ error: VEHICLE_PHOTO_UNSUPPORTED_MESSAGE });
    expect(fromMock).not.toHaveBeenCalled();
    expect(createSignedUrlMock).not.toHaveBeenCalled();
  });
});
