"use client";

import { HandoffVehicleAnimation } from "@/components/vehicle/HandoffVehicleAnimation";
import { VehicleIdentityCard } from "@/components/vehicle/VehicleIdentityCard";
import { useSessionHandoffAnimation } from "@/components/vehicle/useSessionHandoffAnimation";
import {
  isCompleteHandoffVehicle,
  type HandoffVehicle,
} from "@/lib/vehicle/handoff-vehicle";

type HandoffVehicleSectionProps = {
  title: string;
  helper?: string;
  vehicle: HandoffVehicle;
  showRepresentativeNote?: boolean;
  /** When set, plays the approach animation once per browser session. */
  approachAnimationKey?: string;
};

export function HandoffVehicleSection({
  title,
  helper,
  vehicle,
  showRepresentativeNote = false,
  approachAnimationKey,
}: HandoffVehicleSectionProps) {
  const shouldAnimate = useSessionHandoffAnimation(approachAnimationKey ?? "");
  const complete = isCompleteHandoffVehicle(vehicle);
  const showAnimation =
    !!approachAnimationKey && complete && shouldAnimate;

  return (
    <section
      className="flex flex-col gap-2"
      data-testid="handoff-vehicle-section"
    >
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {helper ? (
          <p className="mt-0.5 text-xs leading-5 text-muted">{helper}</p>
        ) : null}
      </div>
      {complete ? (
        <>
          {showAnimation ? (
            <HandoffVehicleAnimation
              vehicleType={vehicle.type!}
              vehicleColor={vehicle.color!}
            />
          ) : null}
          <VehicleIdentityCard
            vehicle={vehicle}
            showRepresentativeNote={showRepresentativeNote}
          />
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
