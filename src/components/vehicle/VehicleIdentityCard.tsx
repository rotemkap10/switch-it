import { VEHICLE_COLOR_LABELS } from "@/lib/vehicle/colors";
import {
  handoffVehicleAccessibleLabel,
  isCompleteHandoffVehicle,
  type HandoffVehicle,
} from "@/lib/vehicle/handoff-vehicle";
import { formatLicensePlateForDisplay } from "@/lib/vehicle/normalize-plate";
import { VEHICLE_TYPE_LABELS } from "@/lib/vehicle/types";
import { VehicleIllustration } from "@/components/vehicle/VehicleIllustration";

type VehicleIdentityCardProps = {
  vehicle: HandoffVehicle;
};

export function VehicleIdentityCard({ vehicle }: VehicleIdentityCardProps) {
  if (!isCompleteHandoffVehicle(vehicle)) {
    return null;
  }

  const { color, type, make, model, licensePlate } = vehicle;
  const plate = formatLicensePlateForDisplay(licensePlate!);
  const accessibleLabel = handoffVehicleAccessibleLabel(vehicle);

  return (
    <div
      className="flex items-center gap-3"
      data-testid="vehicle-identity-card"
    >
      <VehicleIllustration
        vehicleType={type!}
        vehicleColor={color!}
        label={accessibleLabel}
        animate={false}
        className="shrink-0 !p-1.5 [&_svg]:!h-auto [&_svg]:!w-[5.5rem]"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {VEHICLE_COLOR_LABELS[color!]} {VEHICLE_TYPE_LABELS[type!]}
        </p>
        <p className="mt-0.5 truncate text-sm text-muted">
          {make} {model}
        </p>
        <p className="mt-0.5 text-sm font-semibold tracking-wide text-foreground">
          {plate}
        </p>
      </div>
    </div>
  );
}
