import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { VehicleMakeModelFields } from "@/components/vehicle/VehicleMakeModelFields";

function Harness({
  initialMake = "",
  initialModel = "",
}: {
  initialMake?: string;
  initialModel?: string;
}) {
  const [make, setMake] = useState(initialMake);
  const [model, setModel] = useState(initialModel);
  return (
    <form>
      <VehicleMakeModelFields
        make={make}
        model={model}
        onChange={(next) => {
          setMake(next.make);
          setModel(next.model);
        }}
      />
    </form>
  );
}

function hiddenValue(name: "vehicle_make" | "vehicle_model"): string {
  const input = document.querySelector(`input[name="${name}"]`);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Missing hidden input ${name}`);
  }
  return input.value;
}

describe("VehicleMakeModelFields", () => {
  it("opens every manufacturer on focus before the user types", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const manufacturer = screen.getByLabelText("Manufacturer");
    expect(manufacturer).toHaveAttribute("placeholder", "Select manufacturer");
    expect(screen.getByLabelText("Model")).toBeDisabled();
    expect(screen.getByLabelText("Model")).toHaveAttribute(
      "placeholder",
      "Select manufacturer first",
    );

    await user.click(manufacturer);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Toyota" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Hyundai" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Kia" })).toBeInTheDocument();
    expect(screen.getAllByRole("option").length).toBeGreaterThan(20);
  });

  it("filters manufacturer suggestions and stores the canonical make", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText("Manufacturer"), "to");
    const names = screen.getAllByRole("option").map((option) => option.textContent);
    expect(names[0]).toBe("Toyota");
    await user.click(screen.getByRole("option", { name: "Toyota" }));

    expect(hiddenValue("vehicle_make")).toBe("Toyota");
    expect(screen.getByLabelText("Manufacturer")).toHaveValue("Toyota");
  });

  it("suggests a manufacturer typo without saving until selection", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText("Manufacturer"), "toyta");
    expect(screen.getByRole("option", { name: "Toyota" })).toBeInTheDocument();
    expect(hiddenValue("vehicle_make")).toBe("");

    await user.click(screen.getByRole("option", { name: "Toyota" }));
    expect(hiddenValue("vehicle_make")).toBe("Toyota");
  });

  it("opens that manufacturer's models when Model is focused empty", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByLabelText("Model")).toBeDisabled();

    await user.click(screen.getByLabelText("Manufacturer"));
    await user.click(screen.getByRole("option", { name: "Toyota" }));

    const model = screen.getByLabelText("Model");
    expect(model).toBeEnabled();
    expect(model).toHaveAttribute("placeholder", "Select model");
    await user.click(model);

    expect(screen.getByRole("option", { name: "Corolla" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Yaris" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "RAV4" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Camry" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Tucson" })).not.toBeInTheDocument();
  });

  it("filters models and restores the full make list when the query is cleared", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByLabelText("Manufacturer"));
    await user.click(screen.getByRole("option", { name: "Toyota" }));
    await user.type(screen.getByLabelText("Model"), "cor");
    expect(screen.getByRole("option", { name: "Corolla" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Yaris" })).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Model"));
    expect(screen.getByRole("option", { name: "Corolla" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Yaris" })).toBeInTheDocument();
  });

  it("does not show Toyota models under Hyundai", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText("Manufacturer"), "Hyundai");
    await user.click(screen.getByRole("option", { name: "Hyundai" }));
    await user.click(screen.getByLabelText("Model"));
    await user.type(screen.getByLabelText("Model"), "Corolla");

    expect(
      screen.queryByRole("option", { name: "Corolla" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("No matching models")).toBeInTheDocument();
  });

  it("clears an incompatible model when the manufacturer changes", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByLabelText("Manufacturer"));
    await user.click(screen.getByRole("option", { name: "Toyota" }));
    await user.click(screen.getByLabelText("Model"));
    await user.click(screen.getByRole("option", { name: "Corolla" }));
    expect(hiddenValue("vehicle_model")).toBe("Corolla");

    await user.click(screen.getByLabelText("Manufacturer"));
    expect(screen.getByRole("option", { name: "Hyundai" })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Hyundai" }));

    expect(hiddenValue("vehicle_make")).toBe("Hyundai");
    expect(hiddenValue("vehicle_model")).toBe("");
    expect(screen.getByLabelText("Model")).toHaveValue("");

    await user.click(screen.getByLabelText("Model"));
    expect(screen.getByRole("option", { name: "Tucson" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Corolla" })).not.toBeInTheDocument();
  });

  it("normalizes existing lowercase make and model when the match is confident", async () => {
    render(<Harness initialMake="toyota" initialModel="corolla" />);

    await waitFor(() => {
      expect(hiddenValue("vehicle_make")).toBe("Toyota");
      expect(hiddenValue("vehicle_model")).toBe("Corolla");
    });
    expect(screen.getByLabelText("Manufacturer")).toHaveValue("Toyota");
    expect(screen.getByLabelText("Model")).toHaveValue("Corolla");
  });

  it("preserves an unknown existing model instead of deleting it", () => {
    render(<Harness initialMake="toyota" initialModel="corola" />);

    expect(screen.getByLabelText("Manufacturer")).toHaveValue("Toyota");
    expect(screen.getByLabelText("Model")).toHaveValue("corola");
    expect(hiddenValue("vehicle_model")).toBe("corola");
    expect(
      screen.getByRole("button", { name: "Choose model from list" }),
    ).toBeInTheDocument();
  });

  it("lets the user enter an unlisted manufacturer and model", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(
      screen.getByRole("button", { name: "Can't find your manufacturer?" }),
    );
    await user.type(screen.getByLabelText("Manufacturer"), "Koenigsegg");
    await user.type(screen.getByLabelText("Model"), "Jesko");

    expect(hiddenValue("vehicle_make")).toBe("Koenigsegg");
    expect(hiddenValue("vehicle_model")).toBe("Jesko");
    expect(screen.getByTestId("vehicle-other-hint")).toBeInTheDocument();
  });

  it("suggests Corolla for the typo corola but saves only after selection", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText("Manufacturer"), "Toyota");
    await user.click(screen.getByRole("option", { name: "Toyota" }));
    await user.type(screen.getByLabelText("Model"), "corola");

    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toContain("Corolla");
    expect(options[0]).toBe("Corolla");
    expect(hiddenValue("vehicle_model")).toBe("");

    await user.click(screen.getByRole("option", { name: "Corolla" }));
    expect(hiddenValue("vehicle_model")).toBe("Corolla");
    expect(screen.getByLabelText("Model")).toHaveValue("Corolla");
  });

  it("does not suggest Corolla for a typo under Hyundai", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText("Manufacturer"), "Hyundai");
    await user.click(screen.getByRole("option", { name: "Hyundai" }));
    await user.type(screen.getByLabelText("Model"), "corola");

    expect(
      screen.queryByRole("option", { name: "Corolla" }),
    ).not.toBeInTheDocument();
    expect(hiddenValue("vehicle_model")).toBe("");
  });

  it("selects from the open list with keyboard arrows and Enter", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByLabelText("Manufacturer"));
    await user.keyboard("{ArrowDown}{Enter}");
    expect(hiddenValue("vehicle_make")).not.toBe("");
    expect(screen.getByLabelText("Manufacturer")).not.toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Manufacturer"));
    await user.type(screen.getByLabelText("Manufacturer"), "to");
    await user.keyboard("{Enter}");
    expect(hiddenValue("vehicle_make")).toBe("Toyota");

    await user.click(screen.getByLabelText("Model"));
    await user.type(screen.getByLabelText("Model"), "cor");
    await user.keyboard("{Enter}");
    expect(hiddenValue("vehicle_model")).toBe("Corolla");
  });
});
