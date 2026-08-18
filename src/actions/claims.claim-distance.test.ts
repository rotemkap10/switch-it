import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock, requireUserMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  requireUserMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock("@/lib/auth/vehicle-access", () => ({
  assertVehicleProfileCompleteForMutation: vi.fn(async () => ({ ok: true })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  unstable_rethrow: vi.fn(),
}));

import { claimSpot } from "@/actions/claims";
import { APP_ERROR_MESSAGES } from "@/lib/feedback/error-map";

describe("claimSpot server action distance enforcement", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    requireUserMock.mockReset();
    requireUserMock.mockResolvedValue({
      supabase: { rpc: rpcMock },
      user: { id: "user-1" },
    });
  });

  it("rejects missing seeker coordinates before calling the RPC", async () => {
    const formData = new FormData();
    formData.set("spot_id", "550e8400-e29b-41d4-a716-446655440000");

    const result = await claimSpot({}, formData);

    expect(result).toEqual({
      error: APP_ERROR_MESSAGES.LOCATION_REQUIRED,
      errorCode: "LOCATION_REQUIRED",
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("passes seeker coordinates to claim_spot and surfaces CLAIM_TOO_FAR", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "CLAIM_TOO_FAR", code: "P0001" },
    });

    const formData = new FormData();
    formData.set("spot_id", "550e8400-e29b-41d4-a716-446655440000");
    formData.set("seeker_latitude", "32.12");
    formData.set("seeker_longitude", "34.78");

    const result = await claimSpot({}, formData);

    expect(rpcMock).toHaveBeenCalledWith("claim_spot", {
      p_spot_id: "550e8400-e29b-41d4-a716-446655440000",
      p_seeker_latitude: 32.12,
      p_seeker_longitude: 34.78,
    });
    expect(result).toEqual({
      error: APP_ERROR_MESSAGES.CLAIM_TOO_FAR,
      errorCode: "CLAIM_TOO_FAR",
    });
  });

  it("rejects invalid seeker coordinates without calling the RPC", async () => {
    const formData = new FormData();
    formData.set("spot_id", "550e8400-e29b-41d4-a716-446655440000");
    formData.set("seeker_latitude", "999");
    formData.set("seeker_longitude", "34.78");

    const result = await claimSpot({}, formData);

    expect(result.errorCode).toBe("LOCATION_REQUIRED");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
