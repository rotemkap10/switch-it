import {
  VEHICLE_COLOR_LABELS,
  isVehicleColor,
  type VehicleColor,
} from "@/lib/vehicle/colors";
import { formatLicensePlateForDisplay } from "@/lib/vehicle/normalize-plate";
import {
  isVehicleProfileComplete,
  type VehicleProfileFields,
} from "@/lib/vehicle/profile-fields";
import { getVehicleClass } from "@/lib/vehicle/catalog";
import { type VehicleType } from "@/lib/vehicle/types";
import { formatMakeModelYear } from "@/lib/vehicle/years";

export type VehicleSummaryLines = {
  colorType: string;
  makeModel: string;
  plate: string;
  vehicleType: VehicleType;
  vehicleColor: VehicleColor;
};

/** Compact display lines for a complete vehicle profile. */
export function getVehicleSummaryLines(
  vehicle: VehicleProfileFields | null | undefined,
): VehicleSummaryLines | null {
  if (!isVehicleProfileComplete(vehicle) || !vehicle) {
    return null;
  }

  const licensePlate = vehicle.license_plate;
  const make = vehicle.vehicle_make;
  const model = vehicle.vehicle_model;
  const rawColor = vehicle.vehicle_color;

  if (
    !licensePlate ||
    !make ||
    !model ||
    !rawColor ||
    !isVehicleColor(rawColor)
  ) {
    return null;
  }

  const vehicleColor: VehicleColor = rawColor;
  const vehicleType = getVehicleClass(make, model, vehicle.vehicle_type);

  return {
    colorType: VEHICLE_COLOR_LABELS[vehicleColor],
    makeModel: formatMakeModelYear(make, model, vehicle.vehicle_year),
    plate: formatLicensePlateForDisplay(licensePlate),
    vehicleType,
    vehicleColor,
  };
}
