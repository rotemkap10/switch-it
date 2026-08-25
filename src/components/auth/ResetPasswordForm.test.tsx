import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { updatePasswordMock } = vi.hoisted(() => ({
  updatePasswordMock: vi.fn(),
}));

vi.mock("@/actions/auth", () => ({
  updatePasswordFromRecovery: updatePasswordMock,
}));

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import {
  FORGOT_PASSWORD_PATH,
  PASSWORD_MISMATCH_MESSAGE,
  PASSWORD_RESET_LINK_INVALID_MESSAGE,
  PASSWORD_UPDATED_MESSAGE,
} from "@/lib/auth/password-recovery";
import { PASSWORD_POLICY_HINT } from "@/lib/auth/password-policy";

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    updatePasswordMock.mockReset();
    updatePasswordMock.mockResolvedValue({});
  });

  it("shows recoverable invalid-link UI without a recovery session", () => {
    render(<ResetPasswordForm hasRecoverySession={false} />);
    expect(screen.getByTestId("reset-password-invalid")).toBeInTheDocument();
    expect(
      screen.getByText(PASSWORD_RESET_LINK_INVALID_MESSAGE),
    ).toBeInTheDocument();
    expect(screen.getByTestId("reset-password-request-new")).toHaveAttribute(
      "href",
      FORGOT_PASSWORD_PATH,
    );
    expect(screen.queryByTestId("reset-password-form")).not.toBeInTheDocument();
  });

  it("shows the concise password hint without a large checklist", () => {
    render(<ResetPasswordForm hasRecoverySession />);
    expect(screen.getByTestId("password-hint")).toHaveTextContent(
      PASSWORD_POLICY_HINT,
    );
    expect(screen.queryByTestId("password-requirements")).not.toBeInTheDocument();
  });

  it.each([
    ["under 8 characters", "Password needs: 8+ characters."],
    ["missing uppercase", "Password needs: uppercase letter."],
    ["missing lowercase", "Password needs: lowercase letter."],
    ["missing number", "Password needs: number."],
    ["missing special character", "Password needs: special character."],
  ])("rejects %s via shared policy messaging", async (_label, message) => {
    updatePasswordMock.mockResolvedValue({
      fieldErrors: { password: [message] },
    });
    const user = userEvent.setup();
    render(<ResetPasswordForm hasRecoverySession />);

    await user.type(screen.getByLabelText("New password"), "x");
    await user.type(screen.getByLabelText("Confirm new password"), "x");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("rejects password mismatch", async () => {
    updatePasswordMock.mockResolvedValue({
      fieldErrors: { confirm_password: [PASSWORD_MISMATCH_MESSAGE] },
    });
    const user = userEvent.setup();
    render(<ResetPasswordForm hasRecoverySession />);

    await user.type(screen.getByLabelText("New password"), "Password1!");
    await user.type(screen.getByLabelText("Confirm new password"), "Password2!");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText(PASSWORD_MISMATCH_MESSAGE)).toBeInTheDocument();
  });

  it("shows success and Sign in after a valid password update", async () => {
    updatePasswordMock.mockResolvedValue({ passwordUpdated: true });
    const user = userEvent.setup();
    render(<ResetPasswordForm hasRecoverySession />);

    await user.type(screen.getByLabelText("New password"), "Password1!");
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "Password1!",
    );
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByTestId("reset-password-success")).toBeInTheDocument();
    expect(screen.getByText("Password updated")).toBeInTheDocument();
    expect(screen.getByText(PASSWORD_UPDATED_MESSAGE)).toBeInTheDocument();
    expect(screen.getByTestId("reset-password-sign-in")).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
