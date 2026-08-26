import { describe, expect, it } from "vitest";

import {
  PASSWORD_RECOVERY_CALLBACK_PATH,
  PASSWORD_RESET_CHECK_EMAIL_MESSAGE,
  PASSWORD_RESET_PATH,
  PASSWORD_RESET_RATE_LIMIT_MESSAGE,
  authPasswordRecoveryRedirectTo,
  isPasswordRecoveryCallback,
  isPasswordRecoveryPath,
  mapPasswordResetRequestError,
} from "@/lib/auth/password-recovery";

describe("password recovery helpers", () => {
  it("builds recovery redirect through dedicated callback route", () => {
    expect(authPasswordRecoveryRedirectTo("https://switch-it-wine.vercel.app")).toBe(
      `https://switch-it-wine.vercel.app${PASSWORD_RECOVERY_CALLBACK_PATH}`,
    );
    expect(authPasswordRecoveryRedirectTo("https://app.example/")).toBe(
      `https://app.example${PASSWORD_RECOVERY_CALLBACK_PATH}`,
    );
    expect(authPasswordRecoveryRedirectTo("https://app.example")).not.toContain(
      "localhost",
    );
    expect(authPasswordRecoveryRedirectTo("https://app.example")).not.toContain(
      "next=",
    );
  });

  it("detects recovery callback intent from next, type, or forced route", () => {
    expect(isPasswordRecoveryPath(PASSWORD_RESET_PATH)).toBe(true);
    expect(isPasswordRecoveryPath(`${PASSWORD_RESET_PATH}?x=1`)).toBe(true);
    expect(isPasswordRecoveryPath("/map")).toBe(false);
    expect(isPasswordRecoveryPath(null)).toBe(false);
    expect(
      isPasswordRecoveryCallback({ type: "recovery", next: null }),
    ).toBe(true);
    expect(
      isPasswordRecoveryCallback({ forceRecovery: true, next: null }),
    ).toBe(true);
    expect(isPasswordRecoveryCallback({ next: "/map" })).toBe(false);
  });

  it("maps rate limits to friendly reset copy without disclosing account existence", () => {
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
