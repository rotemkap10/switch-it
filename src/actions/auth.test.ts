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
  ACCOUNT_ALREADY_EXISTS_MESSAGE,
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

const VALID_PASSWORD = "Password1!";

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
      data: { session: null, user: { id: "u1", identities: [{ id: "i1" }] } },
      error: null,
    });

    const state = await register(
      {},
      form({
        display_name: "Alex",
        email: "alex@example.com",
        password: VALID_PASSWORD,
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

  it("uses neutral checkEmail for obfuscated existing-email signup success", async () => {
    // Confirm email ON: existing confirmed emails often return fake success
    // (empty identities) with no error — must not claim accountExists.
    signUpMock.mockResolvedValue({
      data: {
        session: null,
        user: {
          id: "fake-id",
          email: "existing@example.com",
          identities: [],
        },
      },
      error: null,
    });

    const state = await register(
      {},
      form({
        display_name: "Alex",
        email: "existing@example.com",
        password: VALID_PASSWORD,
      }),
    );

    expect(state).toEqual({
      checkEmail: true,
      email: "existing@example.com",
    });
    expect(state.accountExists).toBeUndefined();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("maps explicit user_already_exists to accountExists messaging", async () => {
    signUpMock.mockResolvedValue({
      data: { session: null, user: null },
      error: {
        code: "user_already_exists",
        message: "User already registered",
        status: 422,
      },
    });

    const state = await register(
      {},
      form({
        display_name: "Alex",
        email: "existing@example.com",
        password: VALID_PASSWORD,
      }),
    );

    expect(state).toEqual({
      accountExists: true,
      email: "existing@example.com",
      error: ACCOUNT_ALREADY_EXISTS_MESSAGE,
    });
    expect(state.checkEmail).toBeUndefined();
    expect(redirectMock).not.toHaveBeenCalled();
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
          password: VALID_PASSWORD,
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/onboarding/vehicle");
  });

  it("maps Supabase weak-password signup errors to a field message", async () => {
    signUpMock.mockResolvedValue({
      data: { session: null, user: null },
      error: {
        name: "AuthWeakPasswordError",
        code: "weak_password",
        message: "Password is known to be weak",
        reasons: ["characters"],
      },
    });

    const state = await register(
      {},
      form({
        display_name: "Alex",
        email: "alex@example.com",
        password: VALID_PASSWORD,
      }),
    );

    expect(state.fieldErrors?.password?.[0]).toMatch(/security requirements/i);
    expect(state.checkEmail).toBeUndefined();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("rejects weak passwords in the Server Action before calling Auth", async () => {
    const state = await register(
      {},
      form({
        display_name: "Alex",
        email: "alex@example.com",
        password: "password1",
      }),
    );

    expect(signUpMock).not.toHaveBeenCalled();
    expect(state.fieldErrors?.password?.[0]).toBeTruthy();
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
        password: VALID_PASSWORD,
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
          password: VALID_PASSWORD,
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

  it("handles existing emails only via signUp / resend — no Auth admin lookup", async () => {
    signUpMock.mockResolvedValue({
      data: { session: null, user: { id: "u1", identities: [] } },
      error: null,
    });
    resendMock.mockResolvedValue({ data: {}, error: null });

    await register(
      {},
      form({
        display_name: "Alex",
        email: "existing@example.com",
        password: VALID_PASSWORD,
      }),
    );
    await resendSignupVerification(
      { checkEmail: true, email: "existing@example.com" },
      form({ email: "existing@example.com" }),
    );

    const client = await createClientMock.mock.results[0]?.value;
    expect(client.auth.signUp).toBe(signUpMock);
    expect(client.auth.resend).toBe(resendMock);
    expect(client.auth).not.toHaveProperty("admin");
    expect(signUpMock).toHaveBeenCalledTimes(1);
    expect(resendMock).toHaveBeenCalledTimes(1);
  });
});
