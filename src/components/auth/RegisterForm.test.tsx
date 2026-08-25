import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { registerMock, resendMock } = vi.hoisted(() => ({
  registerMock: vi.fn(),
  resendMock: vi.fn(),
}));

vi.mock("@/actions/auth", () => ({
  register: registerMock,
  resendSignupVerification: resendMock,
}));

import { RegisterForm } from "@/components/auth/RegisterForm";
import {
  ACCOUNT_ALREADY_EXISTS_MESSAGE,
  EMAIL_VERIFICATION_RESEND_NEUTRAL_MESSAGE,
} from "@/lib/auth/email-verification";
import { PASSWORD_POLICY_SUMMARY } from "@/lib/auth/password-policy";

describe("RegisterForm mobile layout", () => {
  beforeEach(() => {
    registerMock.mockReset();
    resendMock.mockReset();
    registerMock.mockResolvedValue({});
    resendMock.mockResolvedValue({
      checkEmail: true,
      email: "alex@example.com",
      resendSuccess: true,
    });
  });

  it("renders account fields without vehicle inputs", () => {
    render(<RegisterForm />);

    expect(screen.getByTestId("register-form")).toHaveClass("mobile-form-fields");
    expect(screen.getByLabelText("Display name")).toHaveAttribute(
      "autocomplete",
      "name",
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "autocomplete",
      "email",
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(screen.getByLabelText("Display name")).toHaveClass("app-form-control");
    expect(screen.getByLabelText("Email")).toHaveClass("app-form-control");
    expect(screen.getByLabelText("Password")).toHaveClass("app-form-control");
    expect(screen.getByTestId("password-requirements")).toHaveTextContent(
      PASSWORD_POLICY_SUMMARY,
    );
    expect(screen.queryByLabelText("Vehicle type")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("License plate")).not.toBeInTheDocument();
  });

  it("updates the compact password checklist as the user types", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("Password"), "Password1!");

    const requirements = screen.getByTestId("password-requirements");
    expect(requirements).toHaveTextContent("8+ characters");
    expect(requirements).toHaveTextContent("Uppercase letter");
    expect(requirements).toHaveTextContent("Lowercase letter");
    expect(requirements).toHaveTextContent("Number");
    expect(requirements).toHaveTextContent("Special character");
    expect(
      requirements.querySelectorAll('[data-met="true"]'),
    ).toHaveLength(5);
  });

  it("shows the check-your-email state with Sign in hint for new/obfuscated signup", async () => {
    registerMock.mockResolvedValue({
      checkEmail: true,
      email: "alex@example.com",
    });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("Display name"), "Alex");
    await user.type(screen.getByLabelText("Email"), "alex@example.com");
    await user.type(screen.getByLabelText("Password"), "Password1!");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByTestId("register-check-email")).toBeInTheDocument();
    expect(screen.getByText("Check your email")).toBeInTheDocument();
    expect(screen.getByTestId("register-check-email")).toHaveTextContent(
      "Check your inbox for a verification link to",
    );
    expect(screen.getByTestId("register-check-email-address")).toHaveTextContent(
      "alex@example.com",
    );
    expect(screen.queryByTestId("register-form")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("register-already-registered-hint"),
    ).toHaveTextContent("Already registered with this email?");
    const hintLink = screen
      .getByTestId("register-already-registered-hint")
      .querySelector("a");
    expect(hintLink).toHaveAttribute("href", "/login");
    expect(hintLink).toHaveTextContent("Sign in");
    expect(
      screen.getByRole("button", { name: "Resend email" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return to Sign in" }),
    ).toHaveAttribute("href", "/login");

    await user.click(screen.getByRole("button", { name: "Resend email" }));
    expect(resendMock).toHaveBeenCalled();
    expect(
      await screen.findByTestId("resend-verification-success"),
    ).toHaveTextContent(EMAIL_VERIFICATION_RESEND_NEUTRAL_MESSAGE);
    expect(screen.getByTestId("resend-sign-in-hint")).toHaveTextContent(
      "Already have an account?",
    );
    expect(
      screen.getByTestId("resend-sign-in-hint").querySelector("a"),
    ).toHaveAttribute("href", "/login");
  });

  it("shows explicit account-exists messaging when Auth reports a reliable duplicate", async () => {
    registerMock.mockResolvedValue({
      accountExists: true,
      email: "existing@example.com",
      error: ACCOUNT_ALREADY_EXISTS_MESSAGE,
    });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("Display name"), "Alex");
    await user.type(screen.getByLabelText("Email"), "existing@example.com");
    await user.type(screen.getByLabelText("Password"), "Password1!");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      await screen.findByTestId("register-account-exists"),
    ).toBeInTheDocument();
    expect(screen.getByText(ACCOUNT_ALREADY_EXISTS_MESSAGE)).toBeInTheDocument();
    expect(
      screen.getByTestId("register-account-exists-sign-in"),
    ).toHaveAttribute("href", "/login");
    expect(screen.queryByTestId("register-check-email")).not.toBeInTheDocument();
    expect(screen.queryByText(/new account/i)).not.toBeInTheDocument();
  });
});
