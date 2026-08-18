import { VEHICLE_COLOR_LABELS } from "@/lib/vehicle/colors";
import {
  isCompleteHandoffVehicle,
  type HandoffVehicle,
} from "@/lib/vehicle/handoff-vehicle";
import { formatCanonicalMakeModelYear } from "@/lib/vehicle/catalog";

/** Compact reciprocal summary — viewer's own vehicle. */
export function formatOwnVehicleReciprocalLine(
  vehicle: HandoffVehicle,
): string | null {
  if (!isCompleteHandoffVehicle(vehicle)) {
    return null;
  }
  const color = VEHICLE_COLOR_LABELS[vehicle.color!];
  const identity = formatCanonicalMakeModelYear(
    vehicle.make!,
    vehicle.model!,
    vehicle.year,
  );
  const plate = vehicle.licensePlateMasked;
  if (!plate) {
    return null;
  }
  return `They are looking for your ${color} ${identity}, plate ${plate}.`;
}
