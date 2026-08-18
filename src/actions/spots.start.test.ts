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

import { startHandoffNow } from "@/actions/spots";

const spotId = "550e8400-e29b-41d4-a716-446655440000";

describe("startHandoffNow", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    requireUserMock.mockReset();
    requireUserMock.mockResolvedValue({
      supabase: { rpc: rpcMock },
      user: { id: "owner-1" },
    });
  });

  function form() {
    const formData = new FormData();
    formData.set("spot_id", spotId);
    return formData;
  }

  it("starts the live window from server time", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          spot_id: spotId,
          claim_id: null,
          handoff_started_at: "2026-08-04T13:03:00.000Z",
          expires_at: "2026-08-04T13:06:00.000Z",
          already_started: false,
          changed: true,
        },
      ],
      error: null,
    });

    const result = await startHandoffNow({}, form());

    expect(rpcMock).toHaveBeenCalledWith("start_handoff_now", {
      p_spot_id: spotId,
    });
    expect(result.success).toBe(true);
    expect(result.alreadyStarted).toBe(false);
    expect(result.handoffStartedAt).toBe("2026-08-04T13:03:00.000Z");
    expect(result.expiresAt).toBe("2026-08-04T13:06:00.000Z");
  });

  it("does not treat a second call as a reset", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          spot_id: spotId,
          claim_id: null,
          handoff_started_at: "2026-08-04T13:03:00.000Z",
          expires_at: "2026-08-04T13:06:00.000Z",
          already_started: true,
          changed: false,
        },
      ],
      error: null,
    });

    const result = await startHandoffNow({}, form());

    expect(result.success).toBe(true);
    expect(result.alreadyStarted).toBe(true);
    expect(result.expiresAt).toBe("2026-08-04T13:06:00.000Z");
  });

  it("rejects a start after the lateness window", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "HANDOFF_UNAVAILABLE" },
    });

    const result = await startHandoffNow({}, form());

    expect(result.success).toBeUndefined();
    expect(result.errorCode).toBe("HANDOFF_UNAVAILABLE");
  });

  it("keeps a thrown RPC/network failure as an action error", async () => {
    rpcMock.mockRejectedValue(new Error("Failed to fetch"));

    await expect(startHandoffNow({}, form())).resolves.toMatchObject({
      errorCode: "NETWORK",
    });
  });
});
