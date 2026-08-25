import { describe, expect, it } from "vitest";

import {
  EMAIL_VERIFICATION_FAILED_MESSAGE,
  EMAIL_VERIFICATION_RATE_LIMIT_MESSAGE,
  authCallbackEmailRedirectTo,
  isAuthRateLimitError,
  isEmailNotConfirmedError,
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
