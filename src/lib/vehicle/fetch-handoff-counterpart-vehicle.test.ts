import { describe, expect, it, vi } from "vitest";

import { fetchHandoffCounterpartVehicle } from "@/lib/vehicle/fetch-handoff-counterpart-vehicle";

describe("fetchHandoffCounterpartVehicle", () => {
  it("maps vehicle fields and signs a photo url when a path exists", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://example.test/signed-car.jpg" },
      error: null,
    });
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            vehicle_license_plate: "1234567",
            vehicle_make: "Mazda",
            vehicle_model: "3",
            vehicle_color: "red",
            vehicle_type: "hatchback",
            vehicle_photo_path: "seeker-id/photo.jpg",
          },
        ],
        error: null,
      }),
      storage: {
        from: vi.fn(() => ({ createSignedUrl })),
      },
    };

    await expect(
      fetchHandoffCounterpartVehicle(supabase as never, "claim-1"),
    ).resolves.toEqual({
      licensePlate: "1234567",
      make: "Mazda",
      model: "3",
      color: "red",
      type: "hatchback",
      photoPath: "seeker-id/photo.jpg",
      photoUrl: "https://example.test/signed-car.jpg",
    });
    expect(createSignedUrl).toHaveBeenCalledWith("seeker-id/photo.jpg", 3600);
  });

  it("returns illustration-only data when no photo path is stored", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            vehicle_license_plate: "1234567",
            vehicle_make: "Mazda",
            vehicle_model: "3",
            vehicle_color: "red",
            vehicle_type: "hatchback",
            vehicle_photo_path: null,
          },
        ],
        error: null,
      }),
      storage: {
        from: vi.fn(),
      },
    };

    await expect(
      fetchHandoffCounterpartVehicle(supabase as never, "claim-1"),
    ).resolves.toEqual({
      licensePlate: "1234567",
      make: "Mazda",
      model: "3",
      color: "red",
      type: "hatchback",
      photoPath: null,
      photoUrl: null,
    });
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });
});
