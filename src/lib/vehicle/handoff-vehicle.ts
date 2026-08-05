import { isVehicleColor, VEHICLE_COLOR_LABELS, type VehicleColor } from "@/lib/vehicle/colors";
import { formatLicensePlateForDisplay } from "@/lib/vehicle/normalize-plate";
import { isVehicleType, type VehicleType } from "@/lib/vehicle/types";

export type HandoffVehicle = {
  licensePlate: string | null;
  make: string | null;
  model: string | null;
  color: VehicleColor | null;
  type: VehicleType | null;
};

export type HandoffVehicleRow = {
  vehicle_license_plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_type: string | null;
};

export function mapHandoffVehicleRow(row: HandoffVehicleRow): HandoffVehicle {
  return {
    licensePlate: row.vehicle_license_plate,
    make: row.vehicle_make,
    model: row.vehicle_model,
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

export function handoffVehicleAccessibleLabel(vehicle: HandoffVehicle): string {
  if (!isCompleteHandoffVehicle(vehicle)) {
    return "Vehicle details not added yet";
  }

  const plate = formatLicensePlateForDisplay(vehicle.licensePlate!);
  return `${VEHICLE_COLOR_LABELS[vehicle.color!]} ${vehicle.make} ${vehicle.model}, license plate ${plate}`;
}
