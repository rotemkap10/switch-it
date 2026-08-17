import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Combobox } from "@/components/ui/Combobox";

const options = [
  { value: "Toyota", label: "Toyota" },
  { value: "Hyundai", label: "Hyundai" },
  { value: "Mercedes-Benz", label: "Mercedes-Benz", keywords: ["merc"] },
];

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <Combobox
      id="manufacturer"
      label="Manufacturer"
      value={value}
      onChange={setValue}
      options={options}
      placeholder="Search manufacturer"
    />
  );
}

describe("Combobox", () => {
  it("applies the iOS-safe 16px control class", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Manufacturer")).toHaveClass("app-form-control");
  });

  it("filters options as the user types and selects the canonical value", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText("Manufacturer"), "Toy");
    expect(screen.getByRole("option", { name: "Toyota" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Hyundai" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: "Toyota" }));
    expect(screen.getByLabelText("Manufacturer")).toHaveValue("Toyota");
  });

  it("selects with Enter and closes with Escape", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("Manufacturer");

    await user.click(input);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(input).toHaveValue("Hyundai");

    await user.click(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows a typo suggestion without committing it until click", async () => {
    const user = userEvent.setup();
    function ModelHarness() {
      const [value, setValue] = useState("");
      return (
        <Combobox
          id="model"
          label="Model"
          value={value}
          onChange={setValue}
          options={[
            { value: "Corolla", label: "Corolla" },
            { value: "Camry", label: "Camry" },
            { value: "Yaris", label: "Yaris" },
          ]}
        />
      );
    }

    render(<ModelHarness />);
    await user.type(screen.getByLabelText("Model"), "corola");

    expect(screen.getByRole("option", { name: "Corolla" })).toBeInTheDocument();
    expect(screen.getByLabelText("Model")).toHaveValue("corola");

    await user.click(screen.getByRole("option", { name: "Corolla" }));
    expect(screen.getByLabelText("Model")).toHaveValue("Corolla");
  });
});
