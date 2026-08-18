import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock, requireUserMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  requireUserMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

import { reconcileClaimTiming } from "@/actions/reconcile-claim";

const claimId = "11111111-1111-4111-8111-111111111111";

describe("reconcileClaimTiming", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    requireUserMock.mockReset();
    requireUserMock.mockResolvedValue({
      supabase: { rpc: rpcMock },
      user: { id: "owner-1" },
    });
  });

  it("persists due claimed handoffs through expire_claim_if_needed without a page refresh", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          claim_id: claimId,
          spot_id: "550e8400-e29b-41d4-a716-446655440000",
          claim_status: "active",
          spot_status: "claimed",
          changed: true,
        },
      ],
      error: null,
    });

    const result = await reconcileClaimTiming(claimId);

    expect(rpcMock).toHaveBeenCalledWith("expire_claim_if_needed", {
      p_claim_id: claimId,
    });
    expect(result.success).toBe(true);
    expect(result.changed).toBe(true);
  });

  it("is idempotent when the handoff was already started", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          claim_id: claimId,
          spot_id: "550e8400-e29b-41d4-a716-446655440000",
          claim_status: "active",
          spot_status: "claimed",
          changed: false,
        },
      ],
      error: null,
    });

    const result = await reconcileClaimTiming(claimId);

    expect(result.success).toBe(true);
    expect(result.changed).toBe(false);
  });

  it("does not move credits", async () => {
    rpcMock.mockResolvedValue({
      data: [{ changed: true }],
      error: null,
    });

    await reconcileClaimTiming(claimId);

    expect(rpcMock).not.toHaveBeenCalledWith(
      "complete_claim",
      expect.anything(),
    );
    expect(rpcMock.mock.calls).toHaveLength(1);
    expect(rpcMock.mock.calls[0]?.[0]).toBe("expire_claim_if_needed");
  });
});
