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
  it("filters manufacturer suggestions and stores the canonical make", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText("Manufacturer"), "Toy");
    expect(screen.getByRole("option", { name: "Toyota" })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Toyota" }));

    expect(hiddenValue("vehicle_make")).toBe("Toyota");
    expect(screen.getByLabelText("Manufacturer")).toHaveValue("Toyota");
  });

  it("keeps the model list dependent on manufacturer", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByLabelText("Model")).toBeDisabled();

    await user.type(screen.getByLabelText("Manufacturer"), "Toyota");
    await user.click(screen.getByRole("option", { name: "Toyota" }));

    await user.click(screen.getByLabelText("Model"));
    expect(screen.getByRole("option", { name: "Corolla" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "RAV4" })).toBeInTheDocument();
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

    await user.type(screen.getByLabelText("Manufacturer"), "Toyota");
    await user.click(screen.getByRole("option", { name: "Toyota" }));
    await user.type(screen.getByLabelText("Model"), "Corolla");
    await user.click(screen.getByRole("option", { name: "Corolla" }));
    expect(hiddenValue("vehicle_model")).toBe("Corolla");

    await user.clear(screen.getByLabelText("Manufacturer"));
    await user.type(screen.getByLabelText("Manufacturer"), "Hyundai");
    await user.click(screen.getByRole("option", { name: "Hyundai" }));

    expect(hiddenValue("vehicle_make")).toBe("Hyundai");
    expect(hiddenValue("vehicle_model")).toBe("");
    expect(screen.getByLabelText("Model")).toHaveValue("");
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
});
