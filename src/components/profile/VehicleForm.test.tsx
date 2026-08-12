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

vi.mock("@/actions/vehicle-photo", () => ({
  saveVehiclePhotoPath: vi.fn(),
  removeVehiclePhoto: vi.fn(),
}));

vi.mock("@/lib/vehicle/upload-vehicle-photo-client", () => ({
  uploadVehiclePhotoToStorage: vi.fn(),
  removeUploadedVehiclePhoto: vi.fn(),
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
    expect(screen.getByTestId("vehicle-summary")).toHaveTextContent("SUV");
    expect(screen.getByTestId("vehicle-summary")).toHaveTextContent(
      "Hyundai Tucson",
    );
    expect(screen.getByTestId("vehicle-summary")).toHaveTextContent("12-345-67");
    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-size",
      "hero",
    );
    expect(
      screen.getByRole("button", { name: "Add photo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit vehicle details" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Make")).not.toBeInTheDocument();
  });

  it("shows change and remove when a vehicle photo already exists", () => {
    renderForm(
      <VehicleForm
        initialVehicle={{
          ...existingVehicle,
          vehicle_photo_path: "user/photo.jpg",
        }}
        initialPhotoUrl="https://example.test/car.jpg"
      />,
    );

    expect(screen.getByTestId("vehicle-photo")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "White SUV" })).toHaveAttribute(
      "src",
      "https://example.test/car.jpg",
    );
    expect(screen.getByRole("button", { name: "Change photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove photo" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Take Photo" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("vehicle-illustration")).not.toBeInTheDocument();
  });

  it("expands the editor and populates existing vehicle values", async () => {
    const user = userEvent.setup();
    renderForm(<VehicleForm initialVehicle={existingVehicle} />);

    await user.click(
      screen.getByRole("button", { name: "Edit vehicle details" }),
    );

    expect(screen.getByTestId("vehicle-edit-panel")).toBeInTheDocument();
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
    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-size",
      "hero",
    );
    expect(
      screen.getAllByTestId("vehicle-illustration"),
    ).toHaveLength(1);
  });

  it("closes the editor and returns to the summary", async () => {
    const user = userEvent.setup();
    renderForm(<VehicleForm initialVehicle={existingVehicle} />);

    await user.click(
      screen.getByRole("button", { name: "Edit vehicle details" }),
    );
    expect(screen.getByLabelText("Make")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByTestId("vehicle-summary-panel")).toBeInTheDocument();
    expect(screen.queryByLabelText("Make")).not.toBeInTheDocument();
  });

  it("discards unsaved edits on Cancel and restores persisted values", async () => {
    const user = userEvent.setup();
    renderForm(<VehicleForm initialVehicle={existingVehicle} />);

    await user.click(
      screen.getByRole("button", { name: "Edit vehicle details" }),
    );
    const make = screen.getByLabelText("Make");
    await user.clear(make);
    await user.type(make, "Changed");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(
      screen.getByRole("button", { name: "Edit vehicle details" }),
    );
    expect(screen.getByLabelText("Make")).toHaveValue("Hyundai");
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
  });

  it("updates type and color selection and preview illustration", async () => {
    const user = userEvent.setup();
    renderForm(<VehicleForm initialVehicle={emptyVehicle} />);

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
    expect(screen.getByTestId("vehicle-illustration")).toHaveAttribute(
      "data-size",
      "hero",
    );
  });

  it("shows validation feedback for a partial vehicle", async () => {
    const user = userEvent.setup();
    renderForm(<VehicleForm initialVehicle={emptyVehicle} />);

    await user.type(screen.getByLabelText("Make"), "Toyota");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(screen.getByText("Choose a vehicle type.")).toBeInTheDocument();
      expect(screen.getByText("License plate is required.")).toBeInTheDocument();
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

    await user.selectOptions(screen.getByLabelText("Vehicle type"), "hatchback");
    await user.selectOptions(screen.getByLabelText("Color"), "red");
    await user.type(screen.getByLabelText("Make"), "Mazda");
    await user.type(screen.getByLabelText("Model"), "3");
    await user.type(screen.getByLabelText("License plate"), "1234567");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(screen.getByTestId("feedback-toast-success")).toHaveTextContent(
        "Vehicle updated.",
      );
    });

    expect(updateVehicleMock).toHaveBeenCalled();
    const formData = updateVehicleMock.mock.calls.at(-1)?.[1] as FormData;
    expect(formData.get("vehicle_type")).toBe("hatchback");
    expect(formData.get("vehicle_color")).toBe("red");
    expect(formData.get("vehicle_make")).toBe("Mazda");
    expect(formData.get("vehicle_model")).toBe("3");
    expect(formData.get("license_plate")).toBe("1234567");

    await waitFor(() => {
      expect(screen.getByTestId("vehicle-summary-panel")).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("Make")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit vehicle details" }),
    ).toBeInTheDocument();
  });
});
