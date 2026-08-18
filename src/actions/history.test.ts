import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock, requireUserMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  requireUserMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  unstable_rethrow: vi.fn(),
}));

import { loadMoreHistory } from "@/actions/history";
import { GENERIC_APP_ERROR } from "@/lib/feedback/error-map";

describe("loadMoreHistory", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    requireUserMock.mockReset();
    requireUserMock.mockResolvedValue({
      supabase: { rpc: rpcMock },
      user: { id: "user-1" },
    });
  });

  it("rejects a malformed cursor without calling Postgres", async () => {
    const result = await loadMoreHistory({
      beforeAt: "  ",
      beforeId: "not-a-uuid",
    });

    expect(result).toEqual({ ok: false, error: GENERIC_APP_ERROR });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns the next page for a valid cursor", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          claim_id: "11111111-1111-4111-8111-111111111111",
          role: "seeker",
          status: "expired",
          address: "Rothschild Blvd",
          event_at: "2026-08-01T10:00:00.000Z",
          credit_amount: null,
        },
      ],
      error: null,
    });

    const result = await loadMoreHistory({
      beforeAt: "2026-08-05T12:00:00.000Z",
      beforeId: "22222222-2222-4222-8222-222222222222",
    });

    expect(rpcMock).toHaveBeenCalledWith("get_handoff_history", {
      p_limit: 21,
      p_before_at: "2026-08-05T12:00:00.000Z",
      p_before_id: "22222222-2222-4222-8222-222222222222",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.items).toHaveLength(1);
    expect(result.items[0].status).toBe("expired");
    expect(result.hasMore).toBe(false);
  });

  it("keeps a retryable error when the RPC fails", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    const result = await loadMoreHistory({
      beforeAt: "2026-08-05T12:00:00.000Z",
      beforeId: "22222222-2222-4222-8222-222222222222",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toMatch(/try again/i);
  });
});
