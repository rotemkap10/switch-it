import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loginMock, resendMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  resendMock: vi.fn(),
}));

vi.mock("@/actions/auth", () => ({
  login: loginMock,
  resendSignupVerification: resendMock,
}));

import { LoginForm } from "@/components/auth/LoginForm";
import {
  EMAIL_VERIFICATION_REQUIRED_MESSAGE,
  EMAIL_VERIFICATION_RESEND_NEUTRAL_MESSAGE,
} from "@/lib/auth/email-verification";

describe("LoginForm mobile layout", () => {
  beforeEach(() => {
    loginMock.mockReset();
    resendMock.mockReset();
    loginMock.mockResolvedValue({ error: "Invalid email or password." });
    resendMock.mockResolvedValue({
      needsEmailVerification: true,
      email: "a@example.com",
      resendSuccess: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses mobile form fields with autocomplete and primary CTA", () => {
    render(<LoginForm next="/map" />);

    const form = screen.getByTestId("login-form");
    expect(form.className).toContain("mobile-form-fields");

    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Password");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    expect(email.className).toContain("app-form-control");
    expect(password.className).toContain("app-form-control");

    const submit = screen.getByRole("button", { name: "Sign in" });
    expect(submit.className).toContain("mobile-form-primary");
  });

  it("shows inline credential errors without duplicate toast wiring", async () => {
    const user = userEvent.setup();
    render(<LoginForm next="/map" />);

    await user.type(screen.getByLabelText("Email"), "a@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Invalid email or password."),
    ).toBeInTheDocument();
  });

  it("shows a friendly verification message and resend for unconfirmed accounts", async () => {
    loginMock.mockResolvedValue({
      needsEmailVerification: true,
      email: "a@example.com",
      error: EMAIL_VERIFICATION_REQUIRED_MESSAGE,
    });
    const user = userEvent.setup();
    render(<LoginForm next="/map" />);

    await user.type(screen.getByLabelText("Email"), "a@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByTestId("login-email-verification-required"),
    ).toHaveTextContent(EMAIL_VERIFICATION_REQUIRED_MESSAGE);
    expect(
      screen.getByRole("button", { name: "Resend verification email" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Resend verification email" }),
    );
    expect(resendMock).toHaveBeenCalled();
    expect(
      await screen.findByTestId("resend-verification-success"),
    ).toHaveTextContent(EMAIL_VERIFICATION_RESEND_NEUTRAL_MESSAGE);
  });

  it("surfaces expired verification-link recovery copy", () => {
    render(<LoginForm next="/map" verificationLinkError />);
    expect(
      screen.getByTestId("login-verification-link-error"),
    ).toBeInTheDocument();
  });

  it("shows pending state on submit", async () => {
    loginMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          window.setTimeout(() => resolve({}), 50);
        }),
    );
    const user = userEvent.setup();
    render(<LoginForm next="/map" />);

    await user.type(screen.getByLabelText("Email"), "a@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const pending = await screen.findByRole("button", { name: "Signing in…" });
    expect(pending).toBeDisabled();
    expect(pending).toHaveAttribute("aria-busy", "true");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Sign in" }),
      ).toBeInTheDocument();
    });
  });
});
