import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loginMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
}));

vi.mock("@/actions/auth", () => ({
  login: loginMock,
}));

import { LoginForm } from "@/components/auth/LoginForm";

describe("LoginForm mobile layout", () => {
  beforeEach(() => {
    loginMock.mockReset();
    loginMock.mockResolvedValue({ error: "Invalid email or password." });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses mobile form fields with autocomplete and primary CTA", () => {
    render(<LoginForm next="/map" />);

    const form = screen.getByTestId("login-form");
    expect(form.className).toContain("mobile-form-fields");

    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "autocomplete",
      "email",
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );

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
