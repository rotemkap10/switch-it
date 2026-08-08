import { VEHICLE_COLOR_LABELS } from "@/lib/vehicle/colors";
import {
  formatVehicleNameForDisplay,
  handoffVehicleAccessibleLabel,
  isCompleteHandoffVehicle,
  type HandoffVehicle,
} from "@/lib/vehicle/handoff-vehicle";
import { formatLicensePlateForDisplay } from "@/lib/vehicle/normalize-plate";
import { VehicleIllustration } from "@/components/vehicle/VehicleIllustration";

type VehicleIdentityCardProps = {
  vehicle: HandoffVehicle;
  showRepresentativeNote?: boolean;
};

export function VehicleIdentityCard({ vehicle }: VehicleIdentityCardProps) {
  if (!isCompleteHandoffVehicle(vehicle)) {
    return null;
  }

  const { color, type, make, model, licensePlate } = vehicle;
  const plate = formatLicensePlateForDisplay(licensePlate!);
  const name = formatVehicleNameForDisplay(`${make} ${model}`);
  const colorLabel = VEHICLE_COLOR_LABELS[color!];

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
          title={name}
        >
          {name}
        </p>
        <p className="mt-0.5 truncate text-sm text-muted">
          {colorLabel} · {plate}
        </p>
        <p
          className="vehicle-plate-display mt-2"
          data-testid="vehicle-identity-plate"
          aria-label={`License plate ${plate}`}
        >
          {plate}
        </p>
        <p className="sr-only">{handoffVehicleAccessibleLabel(vehicle)}</p>
      </div>
    </div>
  );
}
