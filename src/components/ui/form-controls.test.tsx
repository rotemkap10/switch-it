import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

describe("shared form controls", () => {
  it("applies the iOS-safe 16px control class to text inputs", () => {
    render(
      <Input id="email" name="email" label="Email" type="email" />,
    );

    expect(screen.getByLabelText("Email")).toHaveClass("app-form-control");
  });

  it("applies the iOS-safe 16px control class to selects", () => {
    render(
      <Select
        id="color"
        name="color"
        label="Color"
        options={[{ value: "silver", label: "Silver" }]}
      />,
    );

    expect(screen.getByLabelText("Color")).toHaveClass("app-form-control");
  });
});
