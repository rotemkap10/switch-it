import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { registerMock } = vi.hoisted(() => ({
  registerMock: vi.fn(),
}));

vi.mock("@/actions/auth", () => ({
  register: registerMock,
}));

import { RegisterForm } from "@/components/auth/RegisterForm";

describe("RegisterForm mobile layout", () => {
  beforeEach(() => {
    registerMock.mockReset();
    registerMock.mockResolvedValue({});
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
    expect(screen.getByText("At least 8 characters.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Vehicle type")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("License plate")).not.toBeInTheDocument();
  });

  it("shows the email confirmation state with a return link", async () => {
    registerMock.mockResolvedValue({ checkEmail: true });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("Display name"), "Alex");
    await user.type(screen.getByLabelText("Email"), "alex@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByTestId("register-check-email")).toBeInTheDocument();
    expect(screen.getByText("Check your email")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return to Sign in" }),
    ).toHaveAttribute("href", "/login");
  });
});
