import { VEHICLE_COLOR_LABELS } from "@/lib/vehicle/colors";
import {
  formatVehicleIdentityTitle,
  handoffVehicleAccessibleLabel,
  isCompleteHandoffVehicle,
  type HandoffVehicle,
} from "@/lib/vehicle/handoff-vehicle";
import { VehicleImage } from "@/components/vehicle/VehicleImage";

type VehicleIdentityCardProps = {
  vehicle: HandoffVehicle;
  showRepresentativeNote?: boolean;
  /** Tighter row used on the publisher live-handoff screen. */
  compact?: boolean;
};

export function VehicleIdentityCard({
  vehicle,
  compact = false,
}: VehicleIdentityCardProps) {
  if (!isCompleteHandoffVehicle(vehicle)) {
    return null;
  }

  const { color, type, make, model, year, licensePlateMasked } = vehicle;
  const name = formatVehicleIdentityTitle(make!, model!, year);
  const colorLabel = VEHICLE_COLOR_LABELS[color!];

  return (
    <div
      className="flex items-center gap-3"
      data-testid="vehicle-identity-card"
      data-compact={compact ? "true" : "false"}
    >
      <VehicleImage
        vehicleType={type}
        vehicleColor={color!}
        make={make}
        model={model}
        year={year}
        animate={false}
        size="compact"
        label={name}
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
        <p
          className="mt-0.5 truncate text-sm text-muted"
          data-testid="vehicle-identity-color"
        >
          {colorLabel}
        </p>
        {compact ? null : (
          <p
            className="vehicle-plate-display mt-2"
            data-testid="vehicle-identity-plate"
            aria-label={`License plate ${licensePlateMasked}`}
          >
            {licensePlateMasked}
          </p>
        )}
        <p className="sr-only">{handoffVehicleAccessibleLabel(vehicle)}</p>
      </div>
    </div>
  );
}
