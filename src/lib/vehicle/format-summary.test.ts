import { describe, expect, it } from "vitest";

import { getVehicleSummaryLines } from "@/lib/vehicle/format-summary";

describe("getVehicleSummaryLines", () => {
  it("returns null for incomplete vehicle", () => {
    expect(
      getVehicleSummaryLines({
        license_plate: null,
        vehicle_make: null,
        vehicle_model: null,
        vehicle_color: null,
        vehicle_type: null,
      }),
    ).toBeNull();
  });

  it("formats color, type, make, model, and plate", () => {
    expect(
      getVehicleSummaryLines({
        license_plate: "1234567",
        vehicle_make: "Hyundai",
        vehicle_model: "Tucson",
        vehicle_color: "white",
        vehicle_type: "suv",
      }),
    ).toEqual({
      colorType: "White SUV",
      makeModel: "Hyundai Tucson",
      plate: "12-345-67",
      vehicleType: "suv",
      vehicleColor: "white",
    });
  });

  it("displays canonical make and model when stored values match the catalog", () => {
    expect(
      getVehicleSummaryLines({
        license_plate: "1234567",
        vehicle_make: "toyota",
        vehicle_model: "corolla",
        vehicle_color: "white",
        vehicle_type: "suv",
      }),
    ).toMatchObject({
      makeModel: "Toyota Corolla",
    });
  });

  it("appends year when the profile has one", () => {
    expect(
      getVehicleSummaryLines({
        license_plate: "1234567",
        vehicle_make: "Hyundai",
        vehicle_model: "Tucson",
        vehicle_year: 2025,
        vehicle_color: "white",
        vehicle_type: "suv",
      }),
    ).toMatchObject({
      makeModel: "Hyundai Tucson · 2025",
    });
  });
});
