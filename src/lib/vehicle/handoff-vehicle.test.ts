import { describe, expect, it } from "vitest";

import {
  handoffVehicleAccessibleLabel,
  isCompleteHandoffVehicle,
  mapHandoffVehicleRow,
} from "@/lib/vehicle/handoff-vehicle";
import { VEHICLE_COLOR_LABELS } from "@/lib/vehicle/colors";
import { formatLicensePlateForDisplay } from "@/lib/vehicle/normalize-plate";
import { VEHICLE_TYPE_LABELS } from "@/lib/vehicle/types";

const completeRow = {
  vehicle_license_plate: "12345678",
  vehicle_make: "Hyundai",
  vehicle_model: "Tucson",
  vehicle_color: "white",
  vehicle_type: "suv",
};

describe("mapHandoffVehicleRow", () => {
  it("maps RPC snake_case columns to HandoffVehicle", () => {
    expect(mapHandoffVehicleRow(completeRow)).toEqual({
      licensePlate: "12345678",
      make: "Hyundai",
      model: "Tucson",
      color: "white",
      type: "suv",
    });
  });

  it("nulls invalid enum values", () => {
    expect(
      mapHandoffVehicleRow({
        ...completeRow,
        vehicle_color: "magenta",
        vehicle_type: "coupe",
      }),
    ).toEqual({
      licensePlate: "12345678",
      make: "Hyundai",
      model: "Tucson",
      color: null,
      type: null,
    });
  });
});

describe("isCompleteHandoffVehicle", () => {
  it("returns true for complete data", () => {
    expect(
      isCompleteHandoffVehicle(mapHandoffVehicleRow(completeRow)),
    ).toBe(true);
  });

  it("returns false for null or partial data", () => {
    expect(
      isCompleteHandoffVehicle({
        licensePlate: null,
        make: null,
        model: null,
        color: null,
        type: null,
      }),
    ).toBe(false);

    expect(
      isCompleteHandoffVehicle({
        licensePlate: "1234567",
        make: "Hyundai",
        model: null,
        color: "white",
        type: "suv",
      }),
    ).toBe(false);
  });
});

describe("handoffVehicleAccessibleLabel", () => {
  it("formats a complete vehicle label with plate", () => {
    const vehicle = mapHandoffVehicleRow(completeRow);
    const plate = formatLicensePlateForDisplay(vehicle.licensePlate!);

    expect(handoffVehicleAccessibleLabel(vehicle)).toBe(
      `${VEHICLE_COLOR_LABELS.white} Hyundai Tucson, license plate ${plate}`,
    );
  });

  it("uses fallback copy for incomplete vehicles", () => {
    expect(
      handoffVehicleAccessibleLabel({
        licensePlate: null,
        make: null,
        model: null,
        color: null,
        type: null,
      }),
    ).toBe("Vehicle details not added yet");
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
