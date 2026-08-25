import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  signUpMock,
  signInWithPasswordMock,
  resendMock,
  getAuthenticatedVehicleStatusMock,
  redirectMock,
  headersMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  signUpMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
  resendMock: vi.fn(),
  getAuthenticatedVehicleStatusMock: vi.fn(),
  redirectMock: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  headersMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/auth/vehicle-status", () => ({
  getAuthenticatedVehicleStatus: getAuthenticatedVehicleStatusMock,
}));

vi.mock("@/lib/auth/post-auth-redirect", () => ({
  resolvePostAuthRedirect: vi.fn(
    (status: { vehicleComplete: boolean }, next?: string) =>
      status.vehicleComplete ? next || "/map" : "/onboarding/vehicle",
  ),
}));

import {
  login,
  register,
  resendSignupVerification,
} from "@/actions/auth";
import {
  EMAIL_VERIFICATION_RATE_LIMIT_MESSAGE,
  EMAIL_VERIFICATION_REQUIRED_MESSAGE,
} from "@/lib/auth/email-verification";

function form(data: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

describe("auth actions — email verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockResolvedValue({
      get: (name: string) => (name === "origin" ? "https://app.example" : null),
    });
    createClientMock.mockResolvedValue({
      auth: {
        signUp: signUpMock,
        signInWithPassword: signInWithPasswordMock,
        resend: resendMock,
        getUser: vi.fn(),
        signOut: vi.fn(),
      },
    });
    getAuthenticatedVehicleStatusMock.mockResolvedValue({
      vehicleComplete: false,
      hasActiveSeekerClaim: false,
      hasActivePublisherSpot: false,
    });
  });

  it("returns checkEmail and does not redirect when signup has no session", async () => {
    signUpMock.mockResolvedValue({
      data: { session: null, user: { id: "u1" } },
      error: null,
    });

    const state = await register(
      {},
      form({
        display_name: "Alex",
        email: "alex@example.com",
        password: "password123",
      }),
    );

    expect(state).toEqual({
      checkEmail: true,
      email: "alex@example.com",
    });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "alex@example.com",
        options: expect.objectContaining({
          emailRedirectTo: "https://app.example/auth/callback",
        }),
      }),
    );
  });

  it("redirects to vehicle onboarding when signup returns a session", async () => {
    signUpMock.mockResolvedValue({
      data: { session: { access_token: "t" }, user: { id: "u1" } },
      error: null,
    });

    await expect(
      register(
        {},
        form({
          display_name: "Alex",
          email: "alex@example.com",
          password: "password123",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/onboarding/vehicle");
  });

  it("maps unconfirmed login to a friendly verification state", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    });

    const state = await login(
      {},
      form({
        email: "alex@example.com",
        password: "password123",
        next: "/map",
      }),
    );

    expect(state).toEqual({
      needsEmailVerification: true,
      email: "alex@example.com",
      error: EMAIL_VERIFICATION_REQUIRED_MESSAGE,
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("keeps verified login redirecting through onboarding status", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "u1" }, session: { access_token: "t" } },
      error: null,
    });
    getAuthenticatedVehicleStatusMock.mockResolvedValue({
      vehicleComplete: true,
      hasActiveSeekerClaim: false,
      hasActivePublisherSpot: false,
    });

    await expect(
      login(
        {},
        form({
          email: "alex@example.com",
          password: "password123",
          next: "/map",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/map");
  });

  it("resends signup verification without creating another account", async () => {
    resendMock.mockResolvedValue({ data: {}, error: null });

    const state = await resendSignupVerification(
      { checkEmail: true, email: "alex@example.com" },
      form({ email: "alex@example.com" }),
    );

    expect(resendMock).toHaveBeenCalledWith({
      type: "signup",
      email: "alex@example.com",
      options: {
        emailRedirectTo: "https://app.example/auth/callback",
      },
    });
    expect(state.resendSuccess).toBe(true);
    expect(state.checkEmail).toBe(true);
    expect(state.email).toBe("alex@example.com");
  });

  it("maps resend rate limits to a friendly message", async () => {
    resendMock.mockResolvedValue({
      data: {},
      error: {
        code: "over_email_send_rate_limit",
        message: "For security purposes, you can only request this after 60 seconds.",
      },
    });

    const state = await resendSignupVerification(
      { checkEmail: true, email: "alex@example.com" },
      form({ email: "alex@example.com" }),
    );

    expect(state.resendSuccess).toBeUndefined();
    expect(state.resendError).toBe(EMAIL_VERIFICATION_RATE_LIMIT_MESSAGE);
  });
});
