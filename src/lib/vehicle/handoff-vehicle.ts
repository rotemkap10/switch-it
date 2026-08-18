import { isVehicleColor, VEHICLE_COLOR_LABELS, type VehicleColor } from "@/lib/vehicle/colors";
import {
  isMaskedLicensePlateDisplay,
  maskLicensePlateForHandoff,
} from "@/lib/vehicle/normalize-plate";
import { isVehicleType, type VehicleType } from "@/lib/vehicle/types";
import { formatCanonicalMakeModelYear } from "@/lib/vehicle/catalog";
import { coerceVehicleYear } from "@/lib/vehicle/years";

export type HandoffVehicle = {
  /** Already-masked display plate (e.g. `12-345-**`). Never the full plate. */
  licensePlateMasked: string | null;
  make: string | null;
  model: string | null;
  year?: number | null;
  color: VehicleColor | null;
  type: VehicleType | null;
};

export type HandoffVehicleRow = {
  vehicle_license_plate_masked?: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year?: number | null;
  vehicle_color: string | null;
  vehicle_type: string | null;
};

function sanitizeMaskedPlate(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const trimmed = value.trim();
  return isMaskedLicensePlateDisplay(trimmed) ? trimmed : null;
}

export function mapHandoffVehicleRow(row: HandoffVehicleRow): HandoffVehicle {
  return {
    licensePlateMasked: sanitizeMaskedPlate(row.vehicle_license_plate_masked),
    make: row.vehicle_make,
    model: row.vehicle_model,
    year: coerceVehicleYear(row.vehicle_year),
    color:
      row.vehicle_color && isVehicleColor(row.vehicle_color)
        ? row.vehicle_color
        : null,
    type:
      row.vehicle_type && isVehicleType(row.vehicle_type)
        ? row.vehicle_type
        : null,
  };
}

/** Map a profiles vehicle row (own vehicle) into handoff shape with a masked plate. */
export function mapProfileVehicleToHandoff(row: {
  license_plate?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | null;
  vehicle_color?: string | null;
  vehicle_type?: string | null;
} | null | undefined): HandoffVehicle | null {
  if (!row) {
    return null;
  }
  return mapHandoffVehicleRow({
    vehicle_license_plate_masked: row.license_plate
      ? maskLicensePlateForHandoff(row.license_plate)
      : null,
    vehicle_make: row.vehicle_make ?? null,
    vehicle_model: row.vehicle_model ?? null,
    vehicle_year: row.vehicle_year ?? null,
    vehicle_color: row.vehicle_color ?? null,
    vehicle_type: row.vehicle_type ?? null,
  });
}

export function isCompleteHandoffVehicle(vehicle: HandoffVehicle): boolean {
  return (
    typeof vehicle.licensePlateMasked === "string" &&
    isMaskedLicensePlateDisplay(vehicle.licensePlateMasked) &&
    typeof vehicle.make === "string" &&
    vehicle.make.trim().length > 0 &&
    typeof vehicle.model === "string" &&
    vehicle.model.trim().length > 0 &&
    vehicle.color !== null &&
    isVehicleColor(vehicle.color)
  );
}

/** Presentation-only title case. Does not mutate stored vehicle strings. */
export function formatVehicleNameForDisplay(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatVehicleIdentityTitle(
  make: string,
  model: string,
  year?: number | null,
): string {
  return formatCanonicalMakeModelYear(make, model, year);
}

export function handoffVehicleAccessibleLabel(vehicle: HandoffVehicle): string {
  if (!isCompleteHandoffVehicle(vehicle)) {
    return "Vehicle details not added yet";
  }

  const yearSuffix = vehicle.year != null ? ` ${vehicle.year}` : "";
  return `${VEHICLE_COLOR_LABELS[vehicle.color!]} ${vehicle.make} ${vehicle.model}${yearSuffix}, license plate ${vehicle.licensePlateMasked}`;
}
