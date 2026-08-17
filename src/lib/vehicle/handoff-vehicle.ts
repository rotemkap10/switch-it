import { isVehicleColor, VEHICLE_COLOR_LABELS, type VehicleColor } from "@/lib/vehicle/colors";
import { formatLicensePlateForDisplay } from "@/lib/vehicle/normalize-plate";
import { isVehicleType, type VehicleType } from "@/lib/vehicle/types";
import { formatCanonicalMakeModelYear } from "@/lib/vehicle/catalog";
import { coerceVehicleYear } from "@/lib/vehicle/years";

export type HandoffVehicle = {
  licensePlate: string | null;
  make: string | null;
  model: string | null;
  year?: number | null;
  color: VehicleColor | null;
  type: VehicleType | null;
  photoPath?: string | null;
  photoUrl?: string | null;
};

export type HandoffVehicleRow = {
  vehicle_license_plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year?: number | null;
  vehicle_color: string | null;
  vehicle_type: string | null;
  vehicle_photo_path?: string | null;
};

export function mapHandoffVehicleRow(row: HandoffVehicleRow): HandoffVehicle {
  return {
    licensePlate: row.vehicle_license_plate,
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
    photoPath: row.vehicle_photo_path ?? null,
  };
}

/** Map a profiles vehicle row (own vehicle) into handoff shape. */
export function mapProfileVehicleToHandoff(row: {
  license_plate?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | null;
  vehicle_color?: string | null;
  vehicle_type?: string | null;
  vehicle_photo_path?: string | null;
} | null | undefined): HandoffVehicle | null {
  if (!row) {
    return null;
  }
  return mapHandoffVehicleRow({
    vehicle_license_plate: row.license_plate ?? null,
    vehicle_make: row.vehicle_make ?? null,
    vehicle_model: row.vehicle_model ?? null,
    vehicle_year: row.vehicle_year ?? null,
    vehicle_color: row.vehicle_color ?? null,
    vehicle_type: row.vehicle_type ?? null,
    vehicle_photo_path: row.vehicle_photo_path ?? null,
  });
}

export function isCompleteHandoffVehicle(vehicle: HandoffVehicle): boolean {
  return (
    typeof vehicle.licensePlate === "string" &&
    vehicle.licensePlate.length > 0 &&
    typeof vehicle.make === "string" &&
    vehicle.make.trim().length > 0 &&
    typeof vehicle.model === "string" &&
    vehicle.model.trim().length > 0 &&
    vehicle.color !== null &&
    isVehicleColor(vehicle.color) &&
    vehicle.type !== null &&
    isVehicleType(vehicle.type)
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

  const plate = formatLicensePlateForDisplay(vehicle.licensePlate!);
  const yearSuffix = vehicle.year != null ? ` ${vehicle.year}` : "";
  return `${VEHICLE_COLOR_LABELS[vehicle.color!]} ${vehicle.make} ${vehicle.model}${yearSuffix}, license plate ${plate}`;
}
