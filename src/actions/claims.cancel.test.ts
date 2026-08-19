import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock, requireUserMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  requireUserMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  unstable_rethrow: vi.fn(),
}));

import { cancelClaim } from "@/actions/claims";
import { cancelSpot } from "@/actions/spots";

const claimId = "550e8400-e29b-41d4-a716-446655440000";
const spotId = "660e8400-e29b-41d4-a716-446655440000";

describe("cancelClaim / cancelSpot reason forwarding", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    requireUserMock.mockReset();
    requireUserMock.mockResolvedValue({
      supabase: { rpc: rpcMock },
      user: { id: "user-1" },
    });
  });

  it("forwards a seeker reason to cancel_claim", async () => {
    rpcMock.mockResolvedValue({
      data: [{ already_cancelled: false }],
      error: null,
    });
    const formData = new FormData();
    formData.set("claim_id", claimId);
    formData.set("reason", "found_another_spot");

    const result = await cancelClaim({}, formData);

    expect(rpcMock).toHaveBeenCalledWith("cancel_claim", {
      p_claim_id: claimId,
      p_reason: "found_another_spot",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a publisher reason on seeker cancel", async () => {
    const formData = new FormData();
    formData.set("claim_id", claimId);
    formData.set("reason", "had_to_leave");

    const result = await cancelClaim({}, formData);

    expect(rpcMock).not.toHaveBeenCalled();
    expect(result.success).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it("forwards a publisher reason to cancel_spot", async () => {
    rpcMock.mockResolvedValue({
      data: [{ already_cancelled: false }],
      error: null,
    });
    const formData = new FormData();
    formData.set("spot_id", spotId);
    formData.set("reason", "someone_else_took_spot");

    const result = await cancelSpot({}, formData);

    expect(rpcMock).toHaveBeenCalledWith("cancel_spot", {
      p_spot_id: spotId,
      p_reason: "someone_else_took_spot",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a seeker reason on publisher cancel", async () => {
    const formData = new FormData();
    formData.set("spot_id", spotId);
    formData.set("reason", "too_far");

    const result = await cancelSpot({}, formData);

    expect(rpcMock).not.toHaveBeenCalled();
    expect(result.success).toBeUndefined();
  });
});
