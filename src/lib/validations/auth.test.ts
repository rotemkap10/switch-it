import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "@/lib/validations/auth";

describe("registerSchema", () => {
  it("accepts a valid registration payload", () => {
    const result = registerSchema.safeParse({
      display_name: "Alex Driver",
      email: "alex@example.com",
      password: "password1",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        display_name: "Alex Driver",
        email: "alex@example.com",
        password: "password1",
      });
    }
  });

  it("trims display_name", () => {
    const result = registerSchema.safeParse({
      display_name: "  Alex  ",
      email: "alex@example.com",
      password: "password1",
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
        password: "password1",
      }).success,
    ).toBe(false);

    expect(
      registerSchema.safeParse({
        display_name: "   ",
        email: "alex@example.com",
        password: "password1",
      }).success,
    ).toBe(false);
  });

  it("rejects display_name longer than 50 characters", () => {
    const result = registerSchema.safeParse({
      display_name: "a".repeat(51),
      email: "alex@example.com",
      password: "password1",
    });

    expect(result.success).toBe(false);
  });

  it("accepts display_name at the 50-character boundary", () => {
    const result = registerSchema.safeParse({
      display_name: "a".repeat(50),
      email: "alex@example.com",
      password: "password1",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      display_name: "Alex",
      email: "not-an-email",
      password: "password1",
    });

    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      display_name: "Alex",
      email: "alex@example.com",
      password: "short",
    });

    expect(result.success).toBe(false);
  });

  it("rejects password longer than 72 characters", () => {
    const result = registerSchema.safeParse({
      display_name: "Alex",
      email: "alex@example.com",
      password: "p".repeat(73),
    });

    expect(result.success).toBe(false);
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
