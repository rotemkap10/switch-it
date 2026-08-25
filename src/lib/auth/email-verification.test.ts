import { describe, expect, it } from "vitest";

import {
  ACCOUNT_ALREADY_EXISTS_MESSAGE,
  EMAIL_VERIFICATION_FAILED_MESSAGE,
  EMAIL_VERIFICATION_RATE_LIMIT_MESSAGE,
  EMAIL_VERIFICATION_RESEND_NEUTRAL_MESSAGE,
  EMAIL_VERIFICATION_SENT_MESSAGE,
  authCallbackEmailRedirectTo,
  isAuthRateLimitError,
  isEmailNotConfirmedError,
  isExplicitAccountExistsError,
  mapResendVerificationError,
} from "@/lib/auth/email-verification";

describe("email verification helpers", () => {
  it("detects unconfirmed email by code and message", () => {
    expect(
      isEmailNotConfirmedError({ code: "email_not_confirmed", message: "" }),
    ).toBe(true);
    expect(
      isEmailNotConfirmedError({
        code: null,
        message: "Email not confirmed",
      }),
    ).toBe(true);
    expect(
      isEmailNotConfirmedError({
        code: "invalid_credentials",
        message: "Invalid login credentials",
      }),
    ).toBe(false);
  });

  it("detects Auth rate limits for resend", () => {
    expect(
      isAuthRateLimitError({
        code: "over_email_send_rate_limit",
        message: "",
      }),
    ).toBe(true);
    expect(
      isAuthRateLimitError({
        status: 429,
        message: "For security purposes, you can only request this after 60 seconds.",
      }),
    ).toBe(true);
    expect(
      isAuthRateLimitError({ code: null, message: "Invalid login credentials" }),
    ).toBe(false);
  });

  it("only treats explicit Auth errors as account-already-exists", () => {
    expect(
      isExplicitAccountExistsError({
        code: "user_already_exists",
        message: "",
      }),
    ).toBe(true);
    expect(
      isExplicitAccountExistsError({
        code: "email_exists",
        message: "Email address already registered",
      }),
    ).toBe(true);
    expect(
      isExplicitAccountExistsError({
        code: null,
        message: "User already registered",
      }),
    ).toBe(true);
    // Obfuscated success / empty identities must NOT be treated as an error signal.
    expect(isExplicitAccountExistsError(null)).toBe(false);
    expect(isExplicitAccountExistsError({ code: null, message: "" })).toBe(
      false,
    );
    expect(
      isExplicitAccountExistsError({
        code: "unexpected_failure",
        message: "Unable to create account",
      }),
    ).toBe(false);
  });

  it("uses neutral resend wording that does not assert delivery", () => {
    expect(EMAIL_VERIFICATION_RESEND_NEUTRAL_MESSAGE).toBe(
      "If this email is awaiting verification, a new verification email has been sent.",
    );
    expect(EMAIL_VERIFICATION_SENT_MESSAGE).toBe(
      EMAIL_VERIFICATION_RESEND_NEUTRAL_MESSAGE,
    );
    expect(ACCOUNT_ALREADY_EXISTS_MESSAGE).toMatch(/already exists/i);
  });

  it("maps resend errors to friendly copy", () => {
    expect(
      mapResendVerificationError({
        code: "over_email_send_rate_limit",
        message: "wait",
      }),
    ).toBe(EMAIL_VERIFICATION_RATE_LIMIT_MESSAGE);
    expect(mapResendVerificationError({ message: "boom" })).toBe(
      EMAIL_VERIFICATION_FAILED_MESSAGE,
    );
  });

  it("builds callback redirect URLs without trailing slash duplication", () => {
    expect(authCallbackEmailRedirectTo("https://switch-it.example")).toBe(
      "https://switch-it.example/auth/callback",
    );
    expect(authCallbackEmailRedirectTo("https://switch-it.example/")).toBe(
      "https://switch-it.example/auth/callback",
    );
  });
});
