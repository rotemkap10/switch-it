import { describe, expect, it } from "vitest";

import { PASSWORD_POLICY_SUMMARY } from "@/lib/auth/password-policy";
import { loginSchema, registerSchema } from "@/lib/validations/auth";

const VALID_PASSWORD = "Password1!";

describe("registerSchema", () => {
  it("accepts a valid registration payload", () => {
    const result = registerSchema.safeParse({
      display_name: "Alex Driver",
      email: "alex@example.com",
      password: VALID_PASSWORD,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        display_name: "Alex Driver",
        email: "alex@example.com",
        password: VALID_PASSWORD,
      });
    }
  });

  it("trims display_name", () => {
    const result = registerSchema.safeParse({
      display_name: "  Alex  ",
      email: "alex@example.com",
      password: VALID_PASSWORD,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.display_name).toBe("Alex");
    }
  });

  it("rejects empty or whitespace-only display_name", () => {
    expect(
      registerSchema.safeParse({
        display_name: "",
        email: "alex@example.com",
        password: VALID_PASSWORD,
      }).success,
    ).toBe(false);

    expect(
      registerSchema.safeParse({
        display_name: "   ",
        email: "alex@example.com",
        password: VALID_PASSWORD,
      }).success,
    ).toBe(false);
  });

  it("rejects display_name longer than 50 characters", () => {
    const result = registerSchema.safeParse({
      display_name: "a".repeat(51),
      email: "alex@example.com",
      password: VALID_PASSWORD,
    });

    expect(result.success).toBe(false);
  });

  it("accepts display_name at the 50-character boundary", () => {
    const result = registerSchema.safeParse({
      display_name: "a".repeat(50),
      email: "alex@example.com",
      password: VALID_PASSWORD,
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      display_name: "Alex",
      email: "not-an-email",
      password: VALID_PASSWORD,
    });

    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      display_name: "Alex",
      email: "alex@example.com",
      password: "Ab1!xyz",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password missing uppercase", () => {
    const result = registerSchema.safeParse({
      display_name: "Alex",
      email: "alex@example.com",
      password: "password1!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password missing lowercase", () => {
    const result = registerSchema.safeParse({
      display_name: "Alex",
      email: "alex@example.com",
      password: "PASSWORD1!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password missing number", () => {
    const result = registerSchema.safeParse({
      display_name: "Alex",
      email: "alex@example.com",
      password: "Password!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password missing special character", () => {
    const result = registerSchema.safeParse({
      display_name: "Alex",
      email: "alex@example.com",
      password: "Password1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password longer than 72 characters", () => {
    const result = registerSchema.safeParse({
      display_name: "Alex",
      email: "alex@example.com",
      password: `Aa1!${"x".repeat(70)}`,
    });

    expect(result.success).toBe(false);
  });

  it("uses the shared password-policy wording", () => {
    const result = registerSchema.safeParse({
      display_name: "Alex",
      email: "alex@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "";
      expect(
        message === PASSWORD_POLICY_SUMMARY ||
          message.toLowerCase().includes("password"),
      ).toBe(true);
    }
  });
});

describe("loginSchema", () => {
  it("accepts a valid login payload", () => {
    const result = loginSchema.safeParse({
      email: "alex@example.com",
      password: "password1",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("alex@example.com");
      expect(result.data.password).toBe("password1");
    }
  });

  it("does not apply signup password policy to login", () => {
    const result = loginSchema.safeParse({
      email: "alex@example.com",
      password: "legacy",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an optional next path", () => {
    const result = loginSchema.safeParse({
      email: "alex@example.com",
      password: "password1",
      next: "/spots/new",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.next).toBe("/spots/new");
    }
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "bad",
      password: "password1",
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "alex@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
  });
});
