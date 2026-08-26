import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  signUpMock,
  signInWithPasswordMock,
  resendMock,
  resetPasswordForEmailMock,
  updateUserMock,
  getUserMock,
  signOutMock,
  getAuthenticatedVehicleStatusMock,
  redirectMock,
  headersMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  signUpMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
  resendMock: vi.fn(),
  resetPasswordForEmailMock: vi.fn(),
  updateUserMock: vi.fn(),
  getUserMock: vi.fn(),
  signOutMock: vi.fn(),
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
  requestPasswordReset,
  resendSignupVerification,
  updatePasswordFromRecovery,
} from "@/actions/auth";
import {
  ACCOUNT_ALREADY_EXISTS_MESSAGE,
  EMAIL_VERIFICATION_RATE_LIMIT_MESSAGE,
  EMAIL_VERIFICATION_REQUIRED_MESSAGE,
} from "@/lib/auth/email-verification";
import {
  PASSWORD_MISMATCH_MESSAGE,
  PASSWORD_RECOVERY_CALLBACK_PATH,
  PASSWORD_RESET_LINK_INVALID_MESSAGE,
  PASSWORD_RESET_PATH,
  PASSWORD_RESET_RATE_LIMIT_MESSAGE,
  authPasswordRecoveryRedirectTo,
} from "@/lib/auth/password-recovery";

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
        resetPasswordForEmail: resetPasswordForEmailMock,
        updateUser: updateUserMock,
        getUser: getUserMock,
        signOut: signOutMock,
      },
    });
    getUserMock.mockResolvedValue({ data: { user: null } });
    signOutMock.mockResolvedValue({ error: null });
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

describe("auth actions — forgot password", () => {
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
        resetPasswordForEmail: resetPasswordForEmailMock,
        updateUser: updateUserMock,
        getUser: getUserMock,
        signOut: signOutMock,
      },
    });
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    signOutMock.mockResolvedValue({ error: null });
  });

  it("requests reset via resetPasswordForEmail with recovery redirect", async () => {
    resetPasswordForEmailMock.mockResolvedValue({ data: {}, error: null });

    const state = await requestPasswordReset(
      {},
      form({ email: "alex@example.com" }),
    );

    expect(resetPasswordForEmailMock).toHaveBeenCalledWith("alex@example.com", {
      redirectTo: authPasswordRecoveryRedirectTo("https://app.example"),
    });
    expect(authPasswordRecoveryRedirectTo("https://app.example")).toBe(
      `https://app.example${PASSWORD_RECOVERY_CALLBACK_PATH}`,
    );
    expect(state).toEqual({
      email: "alex@example.com",
      resetEmailSent: true,
    });
    expect(state.error).toBeUndefined();
  });

  it("does not disclose whether an email exists on successful reset request", async () => {
    resetPasswordForEmailMock.mockResolvedValue({ data: {}, error: null });

    const missing = await requestPasswordReset(
      {},
      form({ email: "nobody@example.com" }),
    );
    const existing = await requestPasswordReset(
      {},
      form({ email: "alex@example.com" }),
    );

    expect(missing.resetEmailSent).toBe(true);
    expect(existing.resetEmailSent).toBe(true);
    expect(missing).toEqual(expect.objectContaining({ resetEmailSent: true }));
    expect(existing).toEqual(expect.objectContaining({ resetEmailSent: true }));
  });

  it("validates forgot-password email", async () => {
    const state = await requestPasswordReset({}, form({ email: "nope" }));
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
    expect(state.fieldErrors?.email?.[0]).toBe("Enter a valid email address.");
  });

  it("maps reset rate limits to a friendly message", async () => {
    resetPasswordForEmailMock.mockResolvedValue({
      data: {},
      error: {
        code: "over_email_send_rate_limit",
        message: "For security purposes, you can only request this after 60 seconds.",
      },
    });

    const state = await requestPasswordReset(
      {},
      form({ email: "alex@example.com" }),
    );

    expect(state.resetEmailSent).toBeUndefined();
    expect(state.error).toBe(PASSWORD_RESET_RATE_LIMIT_MESSAGE);
  });

  it("updates password after recovery and signs out", async () => {
    updateUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const state = await updatePasswordFromRecovery(
      {},
      form({
        password: VALID_PASSWORD,
        confirm_password: VALID_PASSWORD,
      }),
    );

    expect(updateUserMock).toHaveBeenCalledWith({ password: VALID_PASSWORD });
    expect(signOutMock).toHaveBeenCalled();
    expect(state).toEqual({ passwordUpdated: true });
  });

  it("rejects weak and mismatched passwords before/through Auth", async () => {
    const under8 = await updatePasswordFromRecovery(
      {},
      form({ password: "Ab1!", confirm_password: "Ab1!" }),
    );
    expect(under8.fieldErrors?.password?.[0]).toMatch(/8\+/i);
    expect(updateUserMock).not.toHaveBeenCalled();

    const noUpper = await updatePasswordFromRecovery(
      {},
      form({ password: "password1!", confirm_password: "password1!" }),
    );
    expect(noUpper.fieldErrors?.password?.[0]).toMatch(/uppercase/i);

    const noLower = await updatePasswordFromRecovery(
      {},
      form({ password: "PASSWORD1!", confirm_password: "PASSWORD1!" }),
    );
    expect(noLower.fieldErrors?.password?.[0]).toMatch(/lowercase/i);

    const noDigit = await updatePasswordFromRecovery(
      {},
      form({ password: "Password!", confirm_password: "Password!" }),
    );
    expect(noDigit.fieldErrors?.password?.[0]).toMatch(/number/i);

    const noSpecial = await updatePasswordFromRecovery(
      {},
      form({ password: "Password1", confirm_password: "Password1" }),
    );
    expect(noSpecial.fieldErrors?.password?.[0]).toMatch(/special/i);

    const mismatch = await updatePasswordFromRecovery(
      {},
      form({
        password: VALID_PASSWORD,
        confirm_password: "Password2!",
      }),
    );
    expect(mismatch.fieldErrors?.confirm_password?.[0]).toBe(
      PASSWORD_MISMATCH_MESSAGE,
    );
  });

  it("rejects password update without a recovery session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const state = await updatePasswordFromRecovery(
      {},
      form({
        password: VALID_PASSWORD,
        confirm_password: VALID_PASSWORD,
      }),
    );

    expect(updateUserMock).not.toHaveBeenCalled();
    expect(state.error).toBe(PASSWORD_RESET_LINK_INVALID_MESSAGE);
  });

  it("keeps signup verification redirect unchanged", async () => {
    signUpMock.mockResolvedValue({
      data: { session: null, user: { id: "u1" } },
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

    expect(state.checkEmail).toBe(true);
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: "https://app.example/auth/callback",
        }),
      }),
    );
    expect(signUpMock.mock.calls[0]?.[0]?.options?.emailRedirectTo).not.toContain(
      PASSWORD_RESET_PATH,
    );
  });
});
