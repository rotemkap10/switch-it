import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/LoginForm", () => ({
  LoginForm: () => <div data-testid="login-form" />,
}));

vi.mock("@/components/auth/RegisterForm", () => ({
  RegisterForm: () => <div data-testid="register-form" />,
}));

vi.mock("@/components/onboarding/OnboardingVehicleForm", () => ({
  OnboardingVehicleForm: () => <div data-testid="onboarding-vehicle-form" />,
}));

vi.mock("@/lib/auth/vehicle-access", () => ({
  requireAuthenticatedVehicleAccess: vi.fn(async () => ({
    status: { vehicle: null },
  })),
}));

import LoginPage from "@/app/(auth)/login/page";
import RegisterPage from "@/app/(auth)/register/page";
import VehicleOnboardingPage from "@/app/onboarding/vehicle/page";

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("auth and onboarding branding", () => {
  it("shows AuthBrand on login", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("auth-brand").querySelector("img")).toHaveAttribute(
      "src",
      "/branding/switch-it-logo.png",
    );
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });

  it("shows AuthBrand on register", () => {
    render(<RegisterPage />);
    expect(screen.getByTestId("auth-brand").querySelector("img")).toHaveAttribute(
      "src",
      "/branding/switch-it-logo.png",
    );
    expect(
      screen.getByRole("heading", { name: "Create your account" }),
    ).toBeInTheDocument();
  });

  it("shows AuthBrand on vehicle onboarding", async () => {
    render(await VehicleOnboardingPage());
    expect(screen.getByTestId("auth-brand").querySelector("img")).toHaveAttribute(
      "src",
      "/branding/switch-it-logo.png",
    );
    expect(
      screen.getByRole("heading", { name: "Tell drivers what to look for" }),
    ).toBeInTheDocument();
  });

  it("uses the shared AuthBrand component instead of inline wordmarks", () => {
    for (const path of [
      "src/app/(auth)/login/page.tsx",
      "src/app/(auth)/register/page.tsx",
      "src/app/onboarding/vehicle/page.tsx",
    ]) {
      const text = source(path);
      expect(text).toContain("AuthBrand");
      expect(text).not.toMatch(/<p className="auth-brand">Switch It<\/p>/);
    }
  });
});
