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

vi.mock("@/lib/auth/post-auth-redirect", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/auth/post-auth-redirect")
  >("@/lib/auth/post-auth-redirect");
  return actual;
});

import { GET } from "@/app/auth/callback/route";

describe("auth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession: exchangeCodeForSessionMock,
        getUser: getUserMock,
      },
    });
  });

  it("sends incomplete onboarding users to vehicle onboarding after verify", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    getAuthenticatedVehicleStatusMock.mockResolvedValue({
      vehicleComplete: false,
      hasActiveSeekerClaim: false,
      hasActivePublisherSpot: false,
    });

    const response = await GET(
      new Request("https://app.example/auth/callback?code=abc"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.example/onboarding/vehicle",
    );
  });

  it("sends complete users to the app after verify", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    getAuthenticatedVehicleStatusMock.mockResolvedValue({
      vehicleComplete: true,
      hasActiveSeekerClaim: false,
      hasActivePublisherSpot: false,
    });

    const response = await GET(
      new Request("https://app.example/auth/callback?code=abc&next=/map"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example/map");
  });

  it("routes invalid or expired verification links to a recoverable login state", async () => {
    const response = await GET(
      new Request(
        "https://app.example/auth/callback?error=access_denied&error_description=Email+link+is+invalid+or+has+expired",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/login?error=verification",
    );
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
  });

  it("routes failed code exchange to verification recovery", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      error: { message: "invalid" },
    });

    const response = await GET(
      new Request("https://app.example/auth/callback?code=bad"),
    );

    expect(response.headers.get("location")).toBe(
      "https://app.example/login?error=verification",
    );
  });

  it("sends password recovery exchanges to set-new-password", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    getAuthenticatedVehicleStatusMock.mockResolvedValue({
      vehicleComplete: false,
      hasActiveSeekerClaim: false,
      hasActivePublisherSpot: false,
    });

    const response = await GET(
      new Request(
        "https://app.example/auth/callback?code=abc&next=%2Fauth%2Freset-password",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.example/auth/reset-password",
    );
  });

  it("routes invalid recovery links to forgot-password recovery, not signup verification", async () => {
    const response = await GET(
      new Request(
        "https://app.example/auth/callback?error=access_denied&next=%2Fauth%2Freset-password",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://app.example/forgot-password?error=reset",
    );
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
  });
});
