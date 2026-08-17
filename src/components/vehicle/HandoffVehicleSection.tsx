"use client";

import { HandoffVehicleAnimation } from "@/components/vehicle/HandoffVehicleAnimation";
import { VehicleIdentityCard } from "@/components/vehicle/VehicleIdentityCard";
import { useSessionHandoffAnimation } from "@/components/vehicle/useSessionHandoffAnimation";
import {
  isCompleteHandoffVehicle,
  type HandoffVehicle,
} from "@/lib/vehicle/handoff-vehicle";
import { getVehicleClass } from "@/lib/vehicle/catalog";

type HandoffVehicleSectionProps = {
  title: string;
  helper?: string;
  vehicle: HandoffVehicle;
  ownVehicle?: HandoffVehicle | null;
  showRepresentativeNote?: boolean;
  /** When set, plays the approach animation once per browser session. */
  approachAnimationKey?: string;
  /** Compact row for map-centric claimed handoff (no decorative animation). */
  compact?: boolean;
};

export function HandoffVehicleSection({
  title,
  helper,
  vehicle,
  approachAnimationKey,
  compact = false,
}: HandoffVehicleSectionProps) {
  const shouldAnimate = useSessionHandoffAnimation(approachAnimationKey ?? "");
  const complete = isCompleteHandoffVehicle(vehicle);
  const showAnimation =
    !compact && !!approachAnimationKey && complete && shouldAnimate;

  return (
    <section
      className="flex flex-col gap-2"
      data-testid="handoff-vehicle-section"
      data-compact={compact ? "true" : "false"}
    >
      {title ? (
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {helper ? (
            <p className="mt-0.5 text-xs leading-5 text-muted">{helper}</p>
          ) : null}
        </div>
      ) : null}
      {complete ? (
        <>
          {showAnimation ? (
            <HandoffVehicleAnimation
              vehicleType={getVehicleClass(vehicle.make, vehicle.model, vehicle.type)}
              vehicleColor={vehicle.color!}
            />
          ) : null}
          <VehicleIdentityCard vehicle={vehicle} compact={compact} />
        </>
      ) : (
        <p
          className="text-sm text-muted"
          data-testid="handoff-vehicle-fallback"
        >
          Vehicle details not added yet
        </p>
      )}
    </section>
  );
}
