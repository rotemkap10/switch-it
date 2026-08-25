import { describe, expect, it } from "vitest";

import {
  PASSWORD_RESET_CHECK_EMAIL_MESSAGE,
  PASSWORD_RESET_PATH,
  PASSWORD_RESET_RATE_LIMIT_MESSAGE,
  authPasswordRecoveryRedirectTo,
  isPasswordRecoveryPath,
  isPasswordResetRateLimitError,
  mapPasswordResetRequestError,
} from "@/lib/auth/password-recovery";

describe("password recovery helpers", () => {
  it("builds recovery redirect through auth callback without hardcoding localhost", () => {
    expect(authPasswordRecoveryRedirectTo("https://switch-it-wine.vercel.app")).toBe(
      `https://switch-it-wine.vercel.app/auth/callback?next=${encodeURIComponent(PASSWORD_RESET_PATH)}`,
    );
    expect(authPasswordRecoveryRedirectTo("https://app.example/")).toContain(
      "/auth/callback?next=",
    );
    expect(authPasswordRecoveryRedirectTo("https://app.example")).not.toContain(
      "localhost",
    );
  });

  it("detects the set-new-password recovery path", () => {
    expect(isPasswordRecoveryPath(PASSWORD_RESET_PATH)).toBe(true);
    expect(isPasswordRecoveryPath(`${PASSWORD_RESET_PATH}?x=1`)).toBe(true);
    expect(isPasswordRecoveryPath("/map")).toBe(false);
    expect(isPasswordRecoveryPath(null)).toBe(false);
  });

  it("maps rate limits to friendly reset copy without disclosing account existence", () => {
    expect(
      isPasswordResetRateLimitError({
        code: "over_email_send_rate_limit",
        message: "",
      }),
    ).toBe(true);
    expect(
      mapPasswordResetRequestError({
        code: "over_email_send_rate_limit",
        message: "wait",
      }),
    ).toBe(PASSWORD_RESET_RATE_LIMIT_MESSAGE);
    expect(PASSWORD_RESET_CHECK_EMAIL_MESSAGE).toMatch(/if an account exists/i);
    expect(PASSWORD_RESET_CHECK_EMAIL_MESSAGE).not.toMatch(/not found/i);
  });
});
