import { describe, expect, it } from "vitest";

import {
  MIN_VEHICLE_YEAR,
  coerceVehicleYear,
  formatMakeModelYear,
  isVehicleYear,
  maxVehicleYear,
  vehicleYearSelectOptions,
} from "@/lib/vehicle/years";

describe("vehicle year helpers", () => {
  it("allows 1990 through next model year", () => {
    const now = new Date("2026-08-17T00:00:00Z");
    expect(MIN_VEHICLE_YEAR).toBe(1990);
    expect(maxVehicleYear(now)).toBe(2027);
    expect(isVehicleYear(1990, now)).toBe(true);
    expect(isVehicleYear(2025, now)).toBe(true);
    expect(isVehicleYear(2027, now)).toBe(true);
    expect(isVehicleYear(1989, now)).toBe(false);
    expect(isVehicleYear(2028, now)).toBe(false);
    expect(isVehicleYear(2025.5, now)).toBe(false);
  });

  it("coerces 4-digit strings and rejects junk", () => {
    expect(coerceVehicleYear(2024)).toBe(2024);
    expect(coerceVehicleYear("2025")).toBe(2025);
    expect(coerceVehicleYear(" 1990 ")).toBe(1990);
    expect(coerceVehicleYear("")).toBeNull();
    expect(coerceVehicleYear(null)).toBeNull();
    expect(coerceVehicleYear("abc")).toBeNull();
  });

  it("lists years newest first including next model year", () => {
    const options = vehicleYearSelectOptions(new Date("2026-08-17T00:00:00Z"));
    expect(options[0]).toEqual({ value: "2027", label: "2027" });
    expect(options.at(-1)).toEqual({ value: "1990", label: "1990" });
    expect(options).toHaveLength(2027 - 1990 + 1);
  });

  it("appends year only when present", () => {
    expect(formatMakeModelYear("Hyundai", "Tucson", 2025)).toBe(
      "Hyundai Tucson · 2025",
    );
    expect(formatMakeModelYear("Hyundai", "Tucson", null)).toBe("Hyundai Tucson");
    expect(formatMakeModelYear("toyota", "corolla", 2024)).toBe(
      "Toyota Corolla · 2024",
    );
  });
});
