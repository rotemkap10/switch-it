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

import { GET } from "@/app/auth/callback/recovery/route";

describe("auth callback recovery route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession: exchangeCodeForSessionMock,
        getUser: getUserMock,
      },
    });
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    getAuthenticatedVehicleStatusMock.mockResolvedValue({
      vehicleComplete: true,
      hasActiveSeekerClaim: false,
      hasActivePublisherSpot: false,
    });
  });

  it("always redirects a successful code exchange to set-new-password", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });

    const response = await GET(
      new Request("https://app.example/auth/callback/recovery?code=abc"),
    );

    expect(response.headers.get("location")).toBe(
      "https://app.example/auth/reset-password",
    );
    expect(getAuthenticatedVehicleStatusMock).not.toHaveBeenCalled();
  });
});
