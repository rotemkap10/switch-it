import { describe, expect, it, vi } from "vitest";

import { createVehiclePhotoSignedUrl } from "@/lib/vehicle/signed-photo-url";

describe("createVehiclePhotoSignedUrl", () => {
  it("returns null when no path is stored", async () => {
    const supabase = { storage: { from: vi.fn() } };
    await expect(
      createVehiclePhotoSignedUrl(supabase as never, null),
    ).resolves.toBeNull();
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  it("returns a signed url for a stored path", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://example.test/signed.jpg" },
      error: null,
    });
    const supabase = {
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
    };

    await expect(
      createVehiclePhotoSignedUrl(supabase as never, "user/photo.jpg"),
    ).resolves.toBe("https://example.test/signed.jpg");
    expect(supabase.storage.from).toHaveBeenCalledWith("vehicle-photos");
    expect(createSignedUrl).toHaveBeenCalledWith("user/photo.jpg", 3600);
  });

  it("returns null when signing fails so the illustration can fall back", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "not allowed" },
    });
    const supabase = {
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
    };

    await expect(
      createVehiclePhotoSignedUrl(supabase as never, "other-user/photo.jpg"),
    ).resolves.toBeNull();
  });
});
