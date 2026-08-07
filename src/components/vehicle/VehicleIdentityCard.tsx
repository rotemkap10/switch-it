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
  showRepresentativeNote?: boolean;
};

export function VehicleIdentityCard({
  vehicle,
  showRepresentativeNote = false,
}: VehicleIdentityCardProps) {
  if (!isCompleteHandoffVehicle(vehicle)) {
    return null;
  }

  const { color, type, make, model, licensePlate } = vehicle;
  const plate = formatLicensePlateForDisplay(licensePlate!);

  return (
    <div
      className="flex items-start gap-3"
      data-testid="vehicle-identity-card"
    >
      <VehicleIllustration
        vehicleType={type!}
        vehicleColor={color!}
        animate={false}
        size="compact"
        className="shrink-0 shadow-[var(--shadow-card)]"
      />
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-semibold text-foreground"
          data-testid="vehicle-identity-make-model"
          title={`${make} ${model}`}
        >
          {make} {model}
        </p>
        <p className="mt-0.5 truncate text-sm text-muted">
          {VEHICLE_COLOR_LABELS[color!]} {VEHICLE_TYPE_LABELS[type!]}
        </p>
        <p
          className="vehicle-plate-display mt-2"
          data-testid="vehicle-identity-plate"
          aria-label={`License plate ${plate}`}
        >
          {plate}
        </p>
        <p className="sr-only">{handoffVehicleAccessibleLabel(vehicle)}</p>
        {showRepresentativeNote ? (
          <p
            className="mt-1 text-xs text-muted"
            data-testid="vehicle-representative-note"
          >
            Vehicle illustration is representative.
          </p>
        ) : null}
      </div>
    </div>
  );
}
