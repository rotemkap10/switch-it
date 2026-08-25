import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestPasswordResetMock } = vi.hoisted(() => ({
  requestPasswordResetMock: vi.fn(),
}));

vi.mock("@/actions/auth", () => ({
  requestPasswordReset: requestPasswordResetMock,
}));

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { PASSWORD_RESET_CHECK_EMAIL_MESSAGE } from "@/lib/auth/password-recovery";

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    requestPasswordResetMock.mockReset();
    requestPasswordResetMock.mockResolvedValue({});
  });

  it("shows email field errors returned by the Server Action", async () => {
    requestPasswordResetMock.mockResolvedValue({
      fieldErrors: { email: ["Enter a valid email address."] },
    });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Email"), "alex@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("forgot-password-check-email"),
    ).not.toBeInTheDocument();
  });

  it("shows neutral check-your-email copy without disclosing account existence", async () => {
    requestPasswordResetMock.mockResolvedValue({
      resetEmailSent: true,
      email: "alex@example.com",
    });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Email"), "alex@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(
      await screen.findByTestId("forgot-password-check-email"),
    ).toBeInTheDocument();
    expect(screen.getByText("Check your email")).toBeInTheDocument();
    expect(
      screen.getByText(PASSWORD_RESET_CHECK_EMAIL_MESSAGE),
    ).toBeInTheDocument();
    expect(screen.queryByText(/not found/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/doesn'?t exist/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/user does not exist/i)).not.toBeInTheDocument();
  });

  it("shows friendly rate-limit errors", async () => {
    requestPasswordResetMock.mockResolvedValue({
      error: "Too many attempts. Please wait a moment and try again.",
    });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Email"), "alex@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(
      await screen.findByText(
        "Too many attempts. Please wait a moment and try again.",
      ),
    ).toBeInTheDocument();
  });

  it("surfaces invalid recovery-link recovery copy", () => {
    render(<ForgotPasswordForm resetLinkError />);
    expect(
      screen.getByTestId("forgot-password-link-error"),
    ).toBeInTheDocument();
  });
});
