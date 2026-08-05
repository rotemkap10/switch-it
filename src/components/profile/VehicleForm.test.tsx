import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  });

  it("shows setup-required messaging when configured", () => {
    render(<VehicleForm initialVehicle={emptyVehicle} requiresSetup />);

    expect(screen.getByTestId("vehicle-setup-required")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save and continue" }),
    ).toBeInTheDocument();
  });

  it("populates existing vehicle values", () => {
    render(<VehicleForm initialVehicle={existingVehicle} />);

    expect(screen.getByTestId("vehicle-summary")).toHaveTextContent("White");
    expect(screen.getByTestId("vehicle-summary")).toHaveTextContent("SUV");
    expect(screen.getByTestId("vehicle-summary")).toHaveTextContent(
      "Hyundai Tucson",
    );
    expect(screen.getByLabelText("Make")).toHaveValue("Hyundai");
    expect(screen.getByLabelText("Model")).toHaveValue("Tucson");
    expect(screen.getByLabelText("License plate")).toHaveValue("12-345-67");
    expect(screen.getByLabelText("Vehicle type")).toHaveValue("suv");
    expect(screen.getByLabelText("Color")).toHaveValue("white");
    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-vehicle-type",
      "suv",
    );
    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-vehicle-color",
      "white",
    );
  });

  it("updates type and color selection and preview illustration", async () => {
    const user = userEvent.setup();
    render(<VehicleForm initialVehicle={emptyVehicle} />);

    await user.selectOptions(screen.getByLabelText("Vehicle type"), "sedan");
    await user.selectOptions(screen.getByLabelText("Color"), "blue");

    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-vehicle-type",
      "sedan",
    );
    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-vehicle-color",
      "blue",
    );
  });

  it("shows validation feedback for a partial vehicle", async () => {
    const user = userEvent.setup();
    render(<VehicleForm initialVehicle={emptyVehicle} />);

    await user.type(screen.getByLabelText("Make"), "Toyota");
    await user.click(screen.getByRole("button", { name: "Save vehicle" }));

    await waitFor(() => {
      expect(
        screen.getByText(/Complete all vehicle fields/i),
      ).toBeInTheDocument();
    });
  });

  it("submits a complete vehicle successfully", async () => {
    const user = userEvent.setup();
    render(<VehicleForm initialVehicle={emptyVehicle} />);

    await user.selectOptions(screen.getByLabelText("Vehicle type"), "hatchback");
    await user.selectOptions(screen.getByLabelText("Color"), "red");
    await user.type(screen.getByLabelText("Make"), "Mazda");
    await user.type(screen.getByLabelText("Model"), "3");
    await user.type(screen.getByLabelText("License plate"), "1234567");
    await user.click(screen.getByRole("button", { name: "Save vehicle" }));

    await waitFor(() => {
      expect(screen.getByText("Vehicle saved.")).toBeInTheDocument();
    });

    expect(updateVehicleMock).toHaveBeenCalled();
    const formData = updateVehicleMock.mock.calls.at(-1)?.[1] as FormData;
    expect(formData.get("vehicle_type")).toBe("hatchback");
    expect(formData.get("vehicle_color")).toBe("red");
    expect(formData.get("vehicle_make")).toBe("Mazda");
    expect(formData.get("vehicle_model")).toBe("3");
    expect(formData.get("license_plate")).toBe("1234567");
  });
});
