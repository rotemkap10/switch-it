import { VEHICLE_COLOR_LABELS } from "@/lib/vehicle/colors";
import {
  isCompleteHandoffVehicle,
  type HandoffVehicle,
} from "@/lib/vehicle/handoff-vehicle";
import { formatLicensePlateForDisplay } from "@/lib/vehicle/normalize-plate";
import { VEHICLE_TYPE_LABELS } from "@/lib/vehicle/types";

/** Compact reciprocal summary — viewer's own vehicle. */
export function formatOwnVehicleReciprocalLine(
  vehicle: HandoffVehicle,
): string | null {
  if (!isCompleteHandoffVehicle(vehicle)) {
    return null;
  }
  const color = VEHICLE_COLOR_LABELS[vehicle.color!];
  const type = VEHICLE_TYPE_LABELS[vehicle.type!];
  const plate = formatLicensePlateForDisplay(vehicle.licensePlate!);
  return `They are looking for your ${color} ${type}, plate ${plate}.`;
}
