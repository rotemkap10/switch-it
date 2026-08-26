import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  exchangeCodeForSessionMock,
  getUserMock,
  getAuthenticatedVehicleStatusMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  exchangeCodeForSessionMock: vi.fn(),
  getUserMock: vi.fn(),
  getAuthenticatedVehicleStatusMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/auth/vehicle-status", () => ({
  getAuthenticatedVehicleStatus: getAuthenticatedVehicleStatusMock,
}));

import { handleAuthCallback } from "@/lib/auth/auth-callback-handler";

describe("handleAuthCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession: exchangeCodeForSessionMock,
        getUser: getUserMock,
      },
    });
    getAuthenticatedVehicleStatusMock.mockResolvedValue({
      vehicleComplete: true,
      hasActiveSeekerClaim: false,
      hasActivePublisherSpot: false,
    });
  });

  it("sends forced recovery exchanges to set-new-password without onboarding/map", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });

    const response = await handleAuthCallback(
      new Request("https://app.example/auth/callback/recovery?code=abc"),
      { forcePasswordRecovery: true },
    );

    expect(response.headers.get("location")).toBe(
      "https://app.example/auth/reset-password",
    );
    expect(getAuthenticatedVehicleStatusMock).not.toHaveBeenCalled();
  });

  it("treats type=recovery as password recovery even when next is missing", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });

    const response = await handleAuthCallback(
      new Request("https://app.example/auth/callback?code=abc&type=recovery"),
    );

    expect(response.headers.get("location")).toBe(
      "https://app.example/auth/reset-password",
    );
    expect(getAuthenticatedVehicleStatusMock).not.toHaveBeenCalled();
  });

  it("prefers recovery over vehicle-complete map routing when next is present", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });

    const response = await handleAuthCallback(
      new Request(
        "https://app.example/auth/callback?code=abc&next=%2Fauth%2Freset-password",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://app.example/auth/reset-password",
    );
    expect(getAuthenticatedVehicleStatusMock).not.toHaveBeenCalled();
  });

  it("uses normal post-auth routing for signup confirmation without recovery markers", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    getAuthenticatedVehicleStatusMock.mockResolvedValue({
      vehicleComplete: false,
      hasActiveSeekerClaim: false,
      hasActivePublisherSpot: false,
    });

    const response = await handleAuthCallback(
      new Request("https://app.example/auth/callback?code=abc"),
    );

    expect(response.headers.get("location")).toBe(
      "https://app.example/onboarding/vehicle",
    );
  });

  it("sends complete users to map for normal confirmation callbacks", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });

    const response = await handleAuthCallback(
      new Request("https://app.example/auth/callback?code=abc&next=/map"),
    );

    expect(response.headers.get("location")).toBe("https://app.example/map");
  });

  it("rejects unsafe external next values on normal callbacks", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });

    const response = await handleAuthCallback(
      new Request(
        "https://app.example/auth/callback?code=abc&next=https://evil.com",
      ),
    );

    expect(response.headers.get("location")).toBe("https://app.example/map");
  });

  it("routes recovery exchange failures to forgot-password recovery", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      error: { message: "invalid" },
    });

    const response = await handleAuthCallback(
      new Request("https://app.example/auth/callback/recovery?code=bad"),
      { forcePasswordRecovery: true },
    );

    expect(response.headers.get("location")).toBe(
      "https://app.example/forgot-password?error=reset",
    );
  });
});
