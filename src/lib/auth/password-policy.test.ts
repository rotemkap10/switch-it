import { describe, expect, it } from "vitest";

import {
  PASSWORD_POLICY_SUMMARY,
  WEAK_PASSWORD_GENERIC_MESSAGE,
  describePasswordPolicyFailure,
  evaluatePasswordRequirements,
  isPasswordPolicySatisfied,
  isWeakPasswordError,
  mapWeakPasswordError,
} from "@/lib/auth/password-policy";

describe("password policy", () => {
  it("rejects passwords shorter than 8 characters", () => {
    expect(isPasswordPolicySatisfied("Ab1!xyz")).toBe(false);
    expect(describePasswordPolicyFailure("Ab1!xyz")).toMatch(/8\+/i);
  });

  it("rejects missing uppercase", () => {
    expect(isPasswordPolicySatisfied("password1!")).toBe(false);
    expect(describePasswordPolicyFailure("password1!")).toMatch(/uppercase/i);
  });

  it("rejects missing lowercase", () => {
    expect(isPasswordPolicySatisfied("PASSWORD1!")).toBe(false);
    expect(describePasswordPolicyFailure("PASSWORD1!")).toMatch(/lowercase/i);
  });

  it("rejects missing number", () => {
    expect(isPasswordPolicySatisfied("Password!")).toBe(false);
    expect(describePasswordPolicyFailure("Password!")).toMatch(/number/i);
  });

  it("rejects missing special character", () => {
    expect(isPasswordPolicySatisfied("Password1")).toBe(false);
    expect(describePasswordPolicyFailure("Password1")).toMatch(/special/i);
  });

  it("accepts a valid password", () => {
    expect(isPasswordPolicySatisfied("Password1!")).toBe(true);
    expect(describePasswordPolicyFailure("Password1!")).toBeNull();
  });

  it("treats any non-alphanumeric as a special character", () => {
    expect(isPasswordPolicySatisfied("Password1@")).toBe(true);
    expect(isPasswordPolicySatisfied("Password1 ")).toBe(true);
    expect(isPasswordPolicySatisfied("Password1_")).toBe(true);
  });

  it("exposes live requirement checklist flags", () => {
    const reqs = evaluatePasswordRequirements("Aa1!");
    expect(reqs.find((r) => r.id === "length")?.met).toBe(false);
    expect(reqs.find((r) => r.id === "uppercase")?.met).toBe(true);
    expect(reqs.find((r) => r.id === "lowercase")?.met).toBe(true);
    expect(reqs.find((r) => r.id === "digit")?.met).toBe(true);
    expect(reqs.find((r) => r.id === "special")?.met).toBe(true);
  });

  it("detects and maps Supabase weak_password errors", () => {
    expect(
      isWeakPasswordError({
        name: "AuthWeakPasswordError",
        code: "weak_password",
        message: "Password is known to be weak",
        reasons: ["characters"],
      }),
    ).toBe(true);

    expect(
      mapWeakPasswordError({
        code: "weak_password",
        reasons: ["length", "characters"],
      }),
    ).toMatch(/8 characters/i);

    expect(
      mapWeakPasswordError({
        code: "weak_password",
        reasons: ["pwned"],
      }),
    ).toMatch(/breach/i);

    expect(mapWeakPasswordError({ code: "weak_password" })).toBe(
      WEAK_PASSWORD_GENERIC_MESSAGE,
    );
  });

  it("keeps the public summary stable for registration UX", () => {
    expect(PASSWORD_POLICY_SUMMARY).toContain("8 characters");
    expect(PASSWORD_POLICY_SUMMARY).toContain("uppercase");
    expect(PASSWORD_POLICY_SUMMARY).toContain("special character");
  });
});
