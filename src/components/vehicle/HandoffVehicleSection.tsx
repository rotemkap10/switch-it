import { VehicleIdentityCard } from "@/components/vehicle/VehicleIdentityCard";
import {
  isCompleteHandoffVehicle,
  type HandoffVehicle,
} from "@/lib/vehicle/handoff-vehicle";

type HandoffVehicleSectionProps = {
  title: string;
  vehicle: HandoffVehicle;
};

export function HandoffVehicleSection({
  title,
  vehicle,
}: HandoffVehicleSectionProps) {
  return (
    <section
      className="flex flex-col gap-2"
      data-testid="handoff-vehicle-section"
    >
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {isCompleteHandoffVehicle(vehicle) ? (
        <VehicleIdentityCard vehicle={vehicle} />
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
