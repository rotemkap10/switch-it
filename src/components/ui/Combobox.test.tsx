import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Combobox } from "@/components/ui/Combobox";

const options = [
  { value: "Toyota", label: "Toyota" },
  { value: "Hyundai", label: "Hyundai" },
  { value: "Tesla", label: "Tesla" },
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
      placeholder="Select manufacturer"
    />
  );
}

describe("Combobox", () => {
  it("applies the iOS-safe 16px control class and dropdown affordance", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Manufacturer");
    expect(input).toHaveClass("app-form-control");
    expect(input).toHaveClass("ui-combobox__input");
    expect(input).toHaveAttribute("role", "combobox");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
    expect(document.querySelector(".ui-combobox__chevron")).toBeInTheDocument();
  });

  it("opens the full option list on focus before the user types", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByLabelText("Manufacturer"));

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Toyota" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Hyundai" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Tesla" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(options.length);
  });

  it("shows the full list again when a selected field is opened", async () => {
    const user = userEvent.setup();
    render(<Harness initial="Toyota" />);

    await user.click(screen.getByLabelText("Manufacturer"));

    expect(screen.getByRole("option", { name: "Hyundai" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Tesla" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Toyota" })).toHaveAttribute(
      "data-committed",
      "true",
    );
  });

  it("filters options as the user types and selects the canonical value", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText("Manufacturer"), "to");
    const names = screen.getAllByRole("option").map((option) => option.textContent);
    expect(names[0]).toBe("Toyota");
    expect(names).not.toContain("Hyundai");

    await user.click(screen.getByRole("option", { name: "Toyota" }));
    expect(screen.getByLabelText("Manufacturer")).toHaveValue("Toyota");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("restores the full list when the query is cleared", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("Manufacturer");

    await user.type(input, "Toy");
    expect(screen.queryByRole("option", { name: "Hyundai" })).not.toBeInTheDocument();

    await user.clear(input);
    expect(screen.getByRole("option", { name: "Toyota" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Hyundai" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(options.length);
  });

  it("suggests a typo match without committing until the user selects it", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText("Manufacturer"), "toyta");
    expect(screen.getByRole("option", { name: "Toyota" })).toBeInTheDocument();
    expect(screen.getByLabelText("Manufacturer")).toHaveValue("toyta");

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
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.click(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveValue("Hyundai");
  });

  it("suggests a model typo without committing it until click", async () => {
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
