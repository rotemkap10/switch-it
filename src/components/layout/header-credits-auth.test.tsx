import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/LoginForm", () => ({
  LoginForm: () => <div data-testid="login-form" />,
}));

vi.mock("@/components/auth/ForgotPasswordForm", () => ({
  ForgotPasswordForm: () => <div data-testid="forgot-password-form" />,
}));

vi.mock("@/components/auth/RegisterForm", () => ({
  RegisterForm: () => <div data-testid="register-form" />,
}));

import LoginPage from "@/app/(auth)/login/page";
import RegisterPage from "@/app/(auth)/register/page";
import ForgotPasswordPage from "@/app/(auth)/forgot-password/page";

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("auth pages do not show header credits", () => {
  it("does not render credit UI on login", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByTestId("header-credits")).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-nav")).not.toBeInTheDocument();
  });

  it("does not render credit UI on register", () => {
    render(<RegisterPage />);
    expect(screen.queryByTestId("header-credits")).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-nav")).not.toBeInTheDocument();
  });

  it("does not render credit UI on forgot password", async () => {
    render(await ForgotPasswordPage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByTestId("header-credits")).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-nav")).not.toBeInTheDocument();
  });

  it("does not mount AppNav or HeaderCreditsBalance on auth routes", () => {
    for (const path of [
      "src/app/(auth)/login/page.tsx",
      "src/app/(auth)/register/page.tsx",
      "src/app/(auth)/forgot-password/page.tsx",
      "src/app/auth/reset-password/page.tsx",
    ]) {
      const text = source(path);
      expect(text).not.toContain("AppNav");
      expect(text).not.toContain("HeaderCreditsBalance");
      expect(text).not.toContain("AuthenticatedShell");
    }
  });
});
