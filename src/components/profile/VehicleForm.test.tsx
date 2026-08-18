import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeedbackShell } from "@/components/feedback/FeedbackShell";
import { VehicleForm } from "@/components/profile/VehicleForm";
import { updateVehicleSchema } from "@/lib/validations/vehicle";

const { updateVehicleMock } = vi.hoisted(() => ({
  updateVehicleMock: vi.fn(),
}));

vi.mock("@/actions/profile", () => ({
  updateVehicle: updateVehicleMock,
}));

function fieldErrorsFromZod(error: import("zod").ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= [];
    fieldErrors[key].push(issue.message);
  }
  return fieldErrors;
}

function mockUpdateWithSchemaValidation() {
  updateVehicleMock.mockImplementation(
    async (_prev: unknown, formData: FormData) => {
      const parsed = updateVehicleSchema.safeParse({
        license_plate: String(formData.get("license_plate") ?? ""),
        vehicle_make: String(formData.get("vehicle_make") ?? ""),
        vehicle_model: String(formData.get("vehicle_model") ?? ""),
        vehicle_year: String(formData.get("vehicle_year") ?? ""),
        vehicle_color: String(formData.get("vehicle_color") ?? ""),
        vehicle_type: String(formData.get("vehicle_type") ?? ""),
      });

      if (!parsed.success) {
        return { fieldErrors: fieldErrorsFromZod(parsed.error) };
      }

      return {
        success: true,
        vehicle: parsed.data,
      };
    },
  );
}

const emptyVehicle = {
  license_plate: null,
  vehicle_make: null,
  vehicle_model: null,
  vehicle_color: null,
  vehicle_type: null,
};

const existingVehicle = {
  license_plate: "1234567",
  vehicle_make: "Hyundai",
  vehicle_model: "Tucson",
  vehicle_color: "white",
  vehicle_type: "suv",
};

describe("VehicleForm", () => {
  beforeEach(() => {
    updateVehicleMock.mockReset();
    mockUpdateWithSchemaValidation();
    vi.stubGlobal("sessionStorage", {
      store: new Map<string, string>(),
      getItem(key: string) {
        return this.store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        this.store.set(key, value);
      },
    });
  });

  function renderForm(ui: JSX.Element) {
    return render(<FeedbackShell>{ui}</FeedbackShell>);
  }

  it("shows setup-required messaging when configured", () => {
    renderForm(<VehicleForm initialVehicle={emptyVehicle} requiresSetup />);

    expect(screen.getByTestId("vehicle-setup-required")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save and continue" }),
    ).toBeInTheDocument();
  });

  it("keeps a complete vehicle collapsed by default", () => {
    renderForm(<VehicleForm initialVehicle={existingVehicle} />);

    expect(screen.getByTestId("vehicle-summary-panel")).toBeInTheDocument();
    expect(screen.getByTestId("vehicle-summary")).toHaveTextContent("White");
    expect(screen.getByTestId("vehicle-summary")).not.toHaveTextContent("SUV");
    expect(screen.getByTestId("vehicle-summary")).toHaveTextContent(
      "Hyundai Tucson",
    );
    expect(screen.getByTestId("vehicle-summary")).toHaveTextContent("12-345-67");
    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-size",
      "hero",
    );
    expect(screen.queryByRole("button", { name: "Add photo" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit vehicle details" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Manufacturer")).not.toBeInTheDocument();
  });

  it("does not force existing free-text vehicle profiles back into the editor", () => {
    renderForm(
      <VehicleForm
        initialVehicle={{
          ...existingVehicle,
          vehicle_make: "toyota",
          vehicle_model: "corola",
        }}
      />,
    );

    expect(screen.getByTestId("vehicle-summary-panel")).toBeInTheDocument();
    expect(screen.getByTestId("vehicle-summary")).toHaveTextContent(
      "Toyota Corola",
    );
    expect(screen.queryByTestId("vehicle-edit-panel")).not.toBeInTheDocument();
  });

  it("does not force existing profiles without vehicle_type through the editor", () => {
    renderForm(
      <VehicleForm
        initialVehicle={{
          ...existingVehicle,
          vehicle_type: null,
        }}
      />,
    );

    expect(screen.getByTestId("vehicle-summary-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("vehicle-edit-panel")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Vehicle type")).not.toBeInTheDocument();
  });

  it("does not expose vehicle photo upload or remove actions", () => {
    renderForm(<VehicleForm initialVehicle={existingVehicle} />);

    expect(screen.queryByTestId("vehicle-photo")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vehicle-photo-controls")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add photo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change photo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove photo" })).not.toBeInTheDocument();
    expect(screen.getByTestId("vehicle-illustration")).toBeInTheDocument();
  });

  it("expands the editor and populates existing vehicle values", async () => {
    const user = userEvent.setup();
    renderForm(<VehicleForm initialVehicle={existingVehicle} />);

    await user.click(
      screen.getByRole("button", { name: "Edit vehicle details" }),
    );

    expect(screen.getByTestId("vehicle-edit-panel")).toBeInTheDocument();
    expect(screen.getByLabelText("Manufacturer")).toHaveValue("Hyundai");
    expect(screen.getByLabelText("Model")).toHaveValue("Tucson");
    expect(screen.getByLabelText("Vehicle year")).toHaveValue("");
    expect(screen.getByLabelText("License plate")).toHaveValue("12-345-67");
    expect(screen.queryByLabelText("Vehicle type")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Color")).toHaveValue("white");
    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-vehicle-type",
      "suv",
    );
    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-vehicle-color",
      "white",
    );
    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-size",
      "hero",
    );
    expect(
      screen.getAllByTestId("vehicle-illustration"),
    ).toHaveLength(1);
  });

  it("uses the same searchable manufacturer combobox as onboarding", async () => {
    const user = userEvent.setup();
    renderForm(<VehicleForm initialVehicle={emptyVehicle} />);

    const manufacturer = screen.getByLabelText("Manufacturer");
    expect(manufacturer).toHaveAttribute("role", "combobox");
    expect(manufacturer).toHaveAttribute("placeholder", "Select manufacturer");
    expect(screen.getByLabelText("Model")).toBeDisabled();
    expect(screen.getByLabelText("Model")).toHaveAttribute(
      "placeholder",
      "Select manufacturer first",
    );
    expect(
      screen.getByRole("button", { name: "Can't find your manufacturer?" }),
    ).toBeInTheDocument();

    await user.click(manufacturer);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Toyota" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Hyundai" })).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: "Toyota" }));
    await user.click(screen.getByLabelText("Model"));
    expect(screen.getByRole("option", { name: "Corolla" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Can't find your model?" }),
    ).toBeInTheDocument();
  });

  it("closes the editor and returns to the summary", async () => {
    const user = userEvent.setup();
    renderForm(<VehicleForm initialVehicle={existingVehicle} />);

    await user.click(
      screen.getByRole("button", { name: "Edit vehicle details" }),
    );
    expect(screen.getByLabelText("Manufacturer")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByTestId("vehicle-summary-panel")).toBeInTheDocument();
    expect(screen.queryByLabelText("Manufacturer")).not.toBeInTheDocument();
  });

  it("discards unsaved edits on Cancel and restores persisted values", async () => {
    const user = userEvent.setup();
    renderForm(<VehicleForm initialVehicle={existingVehicle} />);

    await user.click(
      screen.getByRole("button", { name: "Edit vehicle details" }),
    );
    const make = screen.getByLabelText("Manufacturer");
    await user.clear(make);
    await user.type(make, "Changed");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(
      screen.getByRole("button", { name: "Edit vehicle details" }),
    );
    expect(screen.getByLabelText("Manufacturer")).toHaveValue("Hyundai");
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
  });

  it("updates color selection and preview illustration class from make/model", async () => {
    const user = userEvent.setup();
    renderForm(<VehicleForm initialVehicle={emptyVehicle} />);

    await user.type(screen.getByLabelText("Manufacturer"), "Toyota");
    await user.click(screen.getByRole("option", { name: "Toyota" }));
    await user.type(screen.getByLabelText("Model"), "Corolla");
    await user.click(screen.getByRole("option", { name: "Corolla" }));
    await user.selectOptions(screen.getByLabelText("Color"), "blue");

    expect(screen.queryByLabelText("Vehicle type")).not.toBeInTheDocument();
    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-vehicle-type",
      "sedan",
    );
    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-vehicle-color",
      "blue",
    );
    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-size",
      "hero",
    );
  });

  it("shows validation feedback for a partial vehicle", async () => {
    const user = userEvent.setup();
    renderForm(<VehicleForm initialVehicle={emptyVehicle} />);

    await user.type(screen.getByLabelText("Manufacturer"), "Toyota");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(screen.getByText("Choose a vehicle color.")).toBeInTheDocument();
      expect(screen.getByText("License plate is required.")).toBeInTheDocument();
      expect(screen.queryByText("Choose a vehicle type.")).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId("feedback-toast-error")).not.toBeInTheDocument();
  });

  it("submits a complete vehicle successfully and collapses", async () => {
    const user = userEvent.setup();
    render(
      <FeedbackShell>
        <VehicleForm initialVehicle={emptyVehicle} />
      </FeedbackShell>,
    );

    await user.selectOptions(screen.getByLabelText("Color"), "red");
    await user.type(screen.getByLabelText("Manufacturer"), "Mazda");
    await user.type(screen.getByLabelText("Model"), "3");
    await user.selectOptions(screen.getByLabelText("Vehicle year"), "2025");
    await user.type(screen.getByLabelText("License plate"), "1234567");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(screen.getByTestId("feedback-toast-success")).toHaveTextContent(
        "Vehicle updated.",
      );
    });

    expect(updateVehicleMock).toHaveBeenCalled();
    const formData = updateVehicleMock.mock.calls.at(-1)?.[1] as FormData;
    expect(formData.get("vehicle_color")).toBe("red");
    expect(formData.get("vehicle_make")).toBe("Mazda");
    expect(formData.get("vehicle_model")).toBe("3");
    expect(formData.get("vehicle_year")).toBe("2025");
    expect(formData.get("license_plate")).toBe("1234567");

    await waitFor(() => {
      expect(screen.getByTestId("vehicle-summary-panel")).toBeInTheDocument();
    });
    expect(screen.getByTestId("vehicle-summary")).toHaveTextContent(
      "Mazda 3 · 2025",
    );
    expect(screen.queryByLabelText("Manufacturer")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit vehicle details" }),
    ).toBeInTheDocument();
  });

  it("shows a saved year in the summary and editor", async () => {
    const user = userEvent.setup();
    renderForm(
      <VehicleForm
        initialVehicle={{
          ...existingVehicle,
          vehicle_year: 2025,
        }}
      />,
    );

    expect(screen.getByTestId("vehicle-summary")).toHaveTextContent(
      "Hyundai Tucson · 2025",
    );

    await user.click(
      screen.getByRole("button", { name: "Edit vehicle details" }),
    );
    expect(screen.getByLabelText("Vehicle year")).toHaveValue("2025");
  });
});
