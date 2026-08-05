import {
  isVehicleColor,
  type VehicleColor,
} from "@/lib/vehicle/colors";
import {
  isVehicleType,
  type VehicleType,
} from "@/lib/vehicle/types";

export type VehicleProfileFields = {
  license_plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_type: string | null;
};

export function isVehicleProfileComplete(
  value: VehicleProfileFields | null | undefined,
): boolean {
  if (!value) {
    return false;
  }

  return (
    typeof value.license_plate === "string" &&
    value.license_plate.length > 0 &&
    typeof value.vehicle_make === "string" &&
    value.vehicle_make.trim().length > 0 &&
    typeof value.vehicle_model === "string" &&
    value.vehicle_model.trim().length > 0 &&
    typeof value.vehicle_color === "string" &&
    isVehicleColor(value.vehicle_color) &&
    typeof value.vehicle_type === "string" &&
    isVehicleType(value.vehicle_type)
  );
}

export type CompleteVehicleProfile = {
  license_plate: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_color: VehicleColor;
  vehicle_type: VehicleType;
};
