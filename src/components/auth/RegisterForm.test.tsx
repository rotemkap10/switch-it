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
    expect(screen.getByText("At least 8 characters.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Vehicle type")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("License plate")).not.toBeInTheDocument();
  });

  it("shows the check-your-email state with the registered address and resend", async () => {
    registerMock.mockResolvedValue({
      checkEmail: true,
      email: "alex@example.com",
    });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("Display name"), "Alex");
    await user.type(screen.getByLabelText("Email"), "alex@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByTestId("register-check-email")).toBeInTheDocument();
    expect(screen.getByText("Check your email")).toBeInTheDocument();
    expect(screen.getByTestId("register-check-email-address")).toHaveTextContent(
      "alex@example.com",
    );
    expect(screen.queryByTestId("register-form")).not.toBeInTheDocument();
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
    ).toHaveTextContent("Verification email sent again.");
  });
});
