import { describe, expect, it } from "vitest";

import { getAuthenticatedVehicleStatus } from "@/lib/auth/vehicle-status";

describe("getAuthenticatedVehicleStatus", () => {
  it("does not throw when a status query rejects", async () => {
    const supabase = {
      from: () => {
        throw new Error("Failed to fetch");
      },
    };

    const status = await getAuthenticatedVehicleStatus(
      supabase as never,
      "user-1",
    );

    expect(status.statusLoadFailed).toBe(true);
    expect(status.vehicleComplete).toBe(false);
    expect(status.hasActiveHandoff).toBe(false);
  });
});
