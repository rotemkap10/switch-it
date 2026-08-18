import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PlateSuffixInput } from "@/components/map/PlateSuffixInput";

function renderInput(error?: string) {
  return render(
    <PlateSuffixInput id="plate_suffix" name="plate_suffix" error={error} />,
  );
}

describe("PlateSuffixInput", () => {
  it("does not focus on mount", () => {
    renderInput();

    const input = screen.getByTestId("plate-suffix-input");
    expect(input).not.toHaveFocus();
    expect(document.activeElement).not.toBe(input);
  });

  it("is a visible editable field before focus", () => {
    renderInput();

    const input = screen.getByRole("textbox", { name: "Last 2 digits" });
    expect(input).not.toHaveFocus();
    expect(input).toHaveClass(
      "plate-suffix-input",
      "app-form-control",
      "rounded-[var(--radius-card)]",
      "border",
      "border-border",
      "bg-surface",
      "text-foreground",
    );
    expect(input).toHaveClass("disabled:opacity-60");
  });

  it("keeps visible chrome when focused, invalid, or disabled", () => {
    const { rerender } = renderInput("Enter the last 2 digits.");
    const chrome = [
      "border",
      "border-border",
      "bg-surface",
      "rounded-[var(--radius-card)]",
    ];

    const invalid = screen.getByTestId("plate-suffix-input");
    expect(invalid).toHaveAttribute("aria-invalid", "true");
    expect(invalid).toHaveClass(...chrome);

    rerender(
      <PlateSuffixInput id="plate_suffix" name="plate_suffix" disabled />,
    );
    const disabled = screen.getByTestId("plate-suffix-input");
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveClass(...chrome);
    expect(disabled).toHaveClass("disabled:opacity-60");
  });

  it("focuses only after the user taps the field", async () => {
    const user = userEvent.setup();
    renderInput();

    const input = screen.getByRole("textbox", { name: "Last 2 digits" });
    expect(input).not.toHaveFocus();

    await user.click(input);
    expect(input).toHaveFocus();
    expect(input).toHaveClass("border", "border-border", "bg-surface");
  });

  it("does not refocus after a rerender or state update", async () => {
    const user = userEvent.setup();
    const { rerender } = renderInput();
    const input = screen.getByTestId("plate-suffix-input");

    await user.click(input);
    expect(input).toHaveFocus();
    await user.tab();
    expect(input).not.toHaveFocus();

    rerender(
      <PlateSuffixInput id="plate_suffix" name="plate_suffix" disabled={false} />,
    );
    expect(screen.getByTestId("plate-suffix-input")).not.toHaveFocus();
  });

  it("does not force focus when a validation error is shown", () => {
    const { rerender } = renderInput();
    expect(screen.getByTestId("plate-suffix-input")).not.toHaveFocus();

    rerender(
      <PlateSuffixInput
        id="plate_suffix"
        name="plate_suffix"
        error="Enter the last 2 digits."
      />,
    );

    expect(screen.getByText("Enter the last 2 digits.")).toBeInTheDocument();
    expect(screen.getByTestId("plate-suffix-input")).not.toHaveFocus();
    expect(screen.getByTestId("plate-suffix-input")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("keeps a numeric keyboard and a two-digit limit", () => {
    renderInput();

    const input = screen.getByTestId("plate-suffix-input");
    expect(input).toHaveAttribute("inputMode", "numeric");
    expect(input).toHaveAttribute("maxLength", "2");
    expect(input).toHaveAttribute("pattern", "[0-9]*");
    expect(input).not.toHaveAttribute("autoFocus");
  });

  it("renders a single verification field, not two OTP boxes", () => {
    renderInput();

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByLabelText("Second plate digit")).not.toBeInTheDocument();
  });

  it("keeps only digits and at most two characters", async () => {
    const user = userEvent.setup();
    renderInput();

    const input = screen.getByRole("textbox", { name: "Last 2 digits" });
    await user.click(input);
    await user.type(input, "6a7b89");

    expect(input).toHaveValue("67");
  });

  it("accepts a pasted two-digit suffix", async () => {
    const user = userEvent.setup();
    renderInput();

    const input = screen.getByRole("textbox", { name: "Last 2 digits" });
    await user.click(input);
    await user.paste("09");

    expect(input).toHaveValue("09");
  });
});
