"use client";

import { HandoffVehicleAnimation } from "@/components/vehicle/HandoffVehicleAnimation";
import { VehicleIdentityCard } from "@/components/vehicle/VehicleIdentityCard";
import { useSessionHandoffAnimation } from "@/components/vehicle/useSessionHandoffAnimation";
import {
  isCompleteHandoffVehicle,
  type HandoffVehicle,
} from "@/lib/vehicle/handoff-vehicle";
import { formatOwnVehicleReciprocalLine } from "@/lib/vehicle/reciprocal-line";

type HandoffVehicleSectionProps = {
  title: string;
  helper?: string;
  vehicle: HandoffVehicle;
  /** Viewer's own vehicle for the reciprocal recognition line. */
  ownVehicle?: HandoffVehicle | null;
  showRepresentativeNote?: boolean;
  /** When set, plays the approach animation once per browser session. */
  approachAnimationKey?: string;
};

export function HandoffVehicleSection({
  title,
  helper,
  vehicle,
  ownVehicle = null,
  showRepresentativeNote = false,
  approachAnimationKey,
}: HandoffVehicleSectionProps) {
  const shouldAnimate = useSessionHandoffAnimation(approachAnimationKey ?? "");
  const complete = isCompleteHandoffVehicle(vehicle);
  const showAnimation =
    !!approachAnimationKey && complete && shouldAnimate;
  const reciprocal =
    ownVehicle != null ? formatOwnVehicleReciprocalLine(ownVehicle) : null;

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
          {reciprocal ? (
            <p
              className="text-xs leading-5 text-muted"
              data-testid="handoff-reciprocal-line"
            >
              {reciprocal}
            </p>
          ) : null}
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
