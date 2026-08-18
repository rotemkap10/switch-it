import { describe, expect, it } from "vitest";

import {
  formatVehicleIdentityTitle,
  formatVehicleNameForDisplay,
  handoffVehicleAccessibleLabel,
  isCompleteHandoffVehicle,
  mapHandoffVehicleRow,
} from "@/lib/vehicle/handoff-vehicle";
import { VEHICLE_COLOR_LABELS } from "@/lib/vehicle/colors";
import { VEHICLE_TYPE_LABELS } from "@/lib/vehicle/types";

const completeRow = {
  vehicle_license_plate_masked: "123-45-6**",
  vehicle_make: "Hyundai",
  vehicle_model: "Tucson",
  vehicle_color: "white",
  vehicle_type: "suv",
};

describe("mapHandoffVehicleRow", () => {
  it("maps RPC snake_case columns to a masked HandoffVehicle", () => {
    expect(mapHandoffVehicleRow(completeRow)).toEqual({
      licensePlateMasked: "123-45-6**",
      make: "Hyundai",
      model: "Tucson",
      year: null,
      color: "white",
      type: "suv",
    });
  });

  it("drops an unmasked plate instead of passing it through", () => {
    expect(
      mapHandoffVehicleRow({
        ...completeRow,
        vehicle_license_plate_masked: "12345678",
      }).licensePlateMasked,
    ).toBeNull();
    expect(
      mapHandoffVehicleRow({
        ...completeRow,
        vehicle_license_plate_masked: "123-45-678",
      }).licensePlateMasked,
    ).toBeNull();
  });

  it("nulls invalid enum values", () => {
    expect(
      mapHandoffVehicleRow({
        ...completeRow,
        vehicle_color: "magenta",
        vehicle_type: "coupe",
      }),
    ).toEqual({
      licensePlateMasked: "123-45-6**",
      make: "Hyundai",
      model: "Tucson",
      year: null,
      color: null,
      type: null,
    });
  });

  it("maps an optional vehicle year without treating it as required", () => {
    expect(
      mapHandoffVehicleRow({
        ...completeRow,
        vehicle_year: 2025,
      }),
    ).toMatchObject({
      year: 2025,
    });
    expect(
      isCompleteHandoffVehicle(
        mapHandoffVehicleRow({
          ...completeRow,
          vehicle_year: null,
        }),
      ),
    ).toBe(true);
  });

  it("does not map a leftover photo path onto the client vehicle", () => {
    const vehicle = mapHandoffVehicleRow(completeRow);
    expect(vehicle).not.toHaveProperty("photoPath");
    expect(vehicle).not.toHaveProperty("photoUrl");
    expect(vehicle).not.toHaveProperty("licensePlate");
  });
});

describe("isCompleteHandoffVehicle", () => {
  it("returns true for complete masked data", () => {
    expect(
      isCompleteHandoffVehicle(mapHandoffVehicleRow(completeRow)),
    ).toBe(true);
  });

  it("returns false for null or partial data", () => {
    expect(
      isCompleteHandoffVehicle({
        licensePlateMasked: null,
        make: null,
        model: null,
        color: null,
        type: null,
      }),
    ).toBe(false);

    expect(
      isCompleteHandoffVehicle({
        licensePlateMasked: "12-345-**",
        make: "Hyundai",
        model: null,
        color: "white",
        type: "suv",
      }),
    ).toBe(false);

    expect(
      isCompleteHandoffVehicle({
        licensePlateMasked: "12-345-**",
        make: "Hyundai",
        model: "Tucson",
        color: "white",
        type: null,
      }),
    ).toBe(true);
  });
});

describe("handoffVehicleAccessibleLabel", () => {
  it("formats a complete vehicle label with the masked plate", () => {
    const vehicle = mapHandoffVehicleRow(completeRow);

    expect(handoffVehicleAccessibleLabel(vehicle)).toBe(
      `${VEHICLE_COLOR_LABELS.white} Hyundai Tucson, license plate 123-45-6**`,
    );
    expect(handoffVehicleAccessibleLabel(vehicle)).not.toContain("678");
  });

  it("includes year in the accessible label when present", () => {
    const vehicle = mapHandoffVehicleRow({
      ...completeRow,
      vehicle_year: 2025,
    });

    expect(handoffVehicleAccessibleLabel(vehicle)).toBe(
      `${VEHICLE_COLOR_LABELS.white} Hyundai Tucson 2025, license plate 123-45-6**`,
    );
  });

  it("uses fallback copy for incomplete vehicles", () => {
    expect(
      handoffVehicleAccessibleLabel({
        licensePlateMasked: null,
        make: null,
        model: null,
        color: null,
        type: null,
      }),
    ).toBe("Vehicle details not added yet");
  });
});

describe("formatVehicleIdentityTitle", () => {
  it("appends year only when present", () => {
    expect(formatVehicleIdentityTitle("hyundai", "tucson", 2025)).toBe(
      "Hyundai Tucson · 2025",
    );
    expect(formatVehicleIdentityTitle("hyundai", "tucson", null)).toBe(
      "Hyundai Tucson",
    );
    expect(formatVehicleIdentityTitle("toyota", "corolla", 2024)).toBe(
      "Toyota Corolla · 2024",
    );
  });
});

describe("formatVehicleNameForDisplay", () => {
  it("title-cases stored make and model without mutating input", () => {
    expect(formatVehicleNameForDisplay("toyota corola")).toBe("Toyota Corola");
    expect(formatVehicleNameForDisplay("  HYUNDAI   tucson ")).toBe(
      "Hyundai Tucson",
    );
  });
});

describe("handoff vehicle label mapping", () => {
  it("maps controlled color and type labels", () => {
    const vehicle = mapHandoffVehicleRow({
      ...completeRow,
      vehicle_color: "blue",
      vehicle_type: "sedan",
    });

    expect(VEHICLE_COLOR_LABELS[vehicle.color!]).toBe("Blue");
    expect(VEHICLE_TYPE_LABELS[vehicle.type!]).toBe("Sedan");
  });
});
