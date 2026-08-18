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
  /** Hides the masked plate (publisher counterpart view). */
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
      className="flex flex-col items-center gap-2.5 text-center"
      data-testid="vehicle-identity-card"
      data-layout="stacked"
      data-presentation="float"
      data-compact={compact ? "true" : "false"}
    >
      <VehicleImage
        vehicleType={type}
        vehicleColor={color!}
        make={make}
        model={model}
        year={year}
        animate={false}
        size="handoff"
        label={name}
        className="shrink-0"
      />
      <div className="min-w-0 w-full">
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
