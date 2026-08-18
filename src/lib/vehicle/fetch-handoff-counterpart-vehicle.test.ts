import { describe, expect, it, vi } from "vitest";

import { fetchHandoffCounterpartVehicle } from "@/lib/vehicle/fetch-handoff-counterpart-vehicle";

describe("fetchHandoffCounterpartVehicle", () => {
  it("maps masked vehicle fields and does not sign photos", async () => {
    const createSignedUrl = vi.fn();
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            vehicle_license_plate_masked: "12-345-**",
            vehicle_make: "Mazda",
            vehicle_model: "3",
            vehicle_year: 2024,
            vehicle_color: "red",
            vehicle_type: "hatchback",
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
      licensePlateMasked: "12-345-**",
      make: "Mazda",
      model: "3",
      year: 2024,
      color: "red",
      type: "hatchback",
    });
    expect(supabase.storage.from).not.toHaveBeenCalled();
    expect(JSON.stringify(await fetchHandoffCounterpartVehicle(supabase as never, "claim-1"))).not.toContain("67");
  });

  it("drops a leaked full plate from the RPC payload", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            vehicle_license_plate_masked: "1234567",
            vehicle_make: "Mazda",
            vehicle_model: "3",
            vehicle_year: null,
            vehicle_color: "red",
            vehicle_type: "hatchback",
          },
        ],
        error: null,
      }),
      storage: {
        from: vi.fn(),
      },
    };

    const vehicle = await fetchHandoffCounterpartVehicle(
      supabase as never,
      "claim-1",
    );
    expect(vehicle?.licensePlateMasked).toBeNull();
    expect(JSON.stringify(vehicle)).not.toContain("1234567");
  });
});
