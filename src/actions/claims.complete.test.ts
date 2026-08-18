import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";

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

import { completeClaim } from "@/actions/claims";

const claimId = "550e8400-e29b-41d4-a716-446655440000";

describe("completeClaim plate verification", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    requireUserMock.mockReset();
    requireUserMock.mockResolvedValue({
      supabase: { rpc: rpcMock },
      user: { id: "publisher-1" },
    });
  });

  function form(suffix: string) {
    const formData = new FormData();
    formData.set("claim_id", claimId);
    formData.set("plate_suffix", suffix);
    return formData;
  }

  it("calls complete_claim with claim id and entered digits only", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          claim_id: claimId,
          spot_id: "660e8400-e29b-41d4-a716-446655440000",
          seeker_credits: 2,
          already_completed: false,
        },
      ],
      error: null,
    });

    const result = await completeClaim({}, form("67"));

    expect(rpcMock).toHaveBeenCalledWith("complete_claim", {
      p_claim_id: claimId,
      p_plate_suffix: "67",
    });
    expect(rpcMock.mock.calls[0]?.[1]).not.toHaveProperty("p_handoff_code");
    expect(rpcMock.mock.calls[0]?.[1]).not.toHaveProperty("expected_digits");
    expect(result.success).toBe(true);
  });

  it("maps remaining attempts from the RPC without returning the correct digits", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: "INVALID_PLATE_DIGITS",
        details: "attempts_remaining=2",
      },
    });

    const result = await completeClaim({}, form("12"));

    expect(result.error).toBe("Those digits don't match. 2 attempts remaining.");
    expect(result.error).not.toContain("67");
    expect(result.lockout).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("67");
  });

  it("locks after the server reports a temporary lockout", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "HANDOFF_TEMPORARILY_LOCKED" },
    });

    const result = await completeClaim({}, form("56"));

    expect(result.lockout).toBe(true);
    expect(result.error).toBe(
      "Too many incorrect attempts. Try again in a moment.",
    );
    expect(result.error).not.toMatch(/\b67\b/);
  });

  it("rejects completion before the publisher starts the handoff", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "HANDOFF_NOT_STARTED" },
    });

    const result = await completeClaim({}, form("67"));

    expect(result.success).toBeUndefined();
    expect(result.error).toBe("The handoff has not started yet.");
    expect(result.errorCode).toBe("HANDOFF_NOT_STARTED");
  });

  it("maps NOT_OWNER when a non-publisher tries to complete", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "NOT_OWNER" },
    });

    const result = await completeClaim({}, form("67"));

    expect(result.success).toBeUndefined();
    expect(result.errorCode).toBe("NOT_OWNER");
    expect(result.error).toBe("Only the publisher can manage this parking spot.");
  });

  it("maps cancelled or expired claims without transferring credits", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "HANDOFF_UNAVAILABLE" },
    });

    const result = await completeClaim({}, form("67"));

    expect(result.success).toBeUndefined();
    expect(result.errorCode).toBe("HANDOFF_UNAVAILABLE");
    expect(result.error).toBe("This handoff can no longer be completed.");
  });

  it("fails safely when the seeker has no credit at completion", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "INSUFFICIENT_CREDITS" },
    });

    const result = await completeClaim({}, form("67"));

    expect(result.success).toBeUndefined();
    expect(result.errorCode).toBe("INSUFFICIENT_CREDITS");
    expect(result.error).toBe("This handoff needs 1 parking credit.");
  });

  it("revalidates publisher and map routes after success", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          claim_id: claimId,
          spot_id: "660e8400-e29b-41d4-a716-446655440000",
          seeker_credits: 2,
          already_completed: false,
        },
      ],
      error: null,
    });

    await completeClaim({}, form("67"));

    expect(revalidatePath).toHaveBeenCalledWith("/map");
    expect(revalidatePath).toHaveBeenCalledWith("/profile");
    expect(revalidatePath).toHaveBeenCalledWith("/spots/new");
  });
});
