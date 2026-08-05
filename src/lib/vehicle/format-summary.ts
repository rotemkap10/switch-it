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
import {
  VEHICLE_TYPE_LABELS,
  isVehicleType,
  type VehicleType,
} from "@/lib/vehicle/types";

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
  const rawType = vehicle.vehicle_type;
  const rawColor = vehicle.vehicle_color;

  if (
    !licensePlate ||
    !make ||
    !model ||
    !rawType ||
    !rawColor ||
    !isVehicleType(rawType) ||
    !isVehicleColor(rawColor)
  ) {
    return null;
  }

  const vehicleType: VehicleType = rawType;
  const vehicleColor: VehicleColor = rawColor;

  return {
    colorType: `${VEHICLE_COLOR_LABELS[vehicleColor]} ${VEHICLE_TYPE_LABELS[vehicleType]}`,
    makeModel: `${make} ${model}`.trim(),
    plate: formatLicensePlateForDisplay(licensePlate),
    vehicleType,
    vehicleColor,
  };
}
