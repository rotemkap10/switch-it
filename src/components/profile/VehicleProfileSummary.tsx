"use client";

import { VehicleImage } from "@/components/vehicle/VehicleImage";
import { getVehicleSummaryLines } from "@/lib/vehicle/format-summary";
import { useOneShotAnimation } from "@/lib/motion/use-one-shot-animation";
import type { VehicleProfileFields } from "@/lib/vehicle/profile-fields";

type VehicleProfileSummaryProps = {
  vehicle: VehicleProfileFields;
  photoUrl?: string | null;
  /**
   * `stacked` — large full-width illustration above compact text (profile card).
   * `inline` — text-only compact block (top summary row).
   */
  variant?: "stacked" | "inline";
  /** One-time profile hero entrance (session-scoped). */
  entranceAnimation?: boolean;
  className?: string;
};

export function VehicleProfileSummary({
  vehicle,
  photoUrl = null,
  variant = "inline",
  entranceAnimation = false,
  className = "",
}: VehicleProfileSummaryProps) {
  const summary = getVehicleSummaryLines(vehicle);
  const driveIn = useOneShotAnimation(
    entranceAnimation && variant === "stacked"
      ? "profile-vehicle-hero-entrance"
      : null,
  );

  if (!summary) {
    return (
      <p
        className={["text-sm text-muted", className].join(" ")}
        data-testid="vehicle-summary-empty"
      >
        No vehicle details yet
      </p>
    );
  }

  const details = (
    <div
      className={
        variant === "stacked"
          ? "flex flex-col items-center gap-1 text-center"
          : "min-w-0 flex-1"
      }
    >
      <p
        className={[
          "font-semibold text-foreground",
          variant === "stacked" ? "text-base" : "truncate text-sm",
        ].join(" ")}
      >
        {summary.colorType}
      </p>
      <p
        className={[
          "text-muted",
          variant === "stacked" ? "text-sm" : "mt-0.5 truncate text-sm",
        ].join(" ")}
      >
        {summary.makeModel}
      </p>
      <p
        className={[
          "vehicle-plate-display",
          variant === "stacked" ? "mt-2" : "mt-1.5",
        ].join(" ")}
      >
        {summary.plate}
      </p>
    </div>
  );

  if (variant === "stacked") {
    return (
      <div
        className={["flex flex-col gap-4", className].join(" ")}
        data-testid="vehicle-summary"
      >
        <VehicleImage
          photoUrl={photoUrl}
          vehicleType={summary.vehicleType}
          vehicleColor={summary.vehicleColor}
          make={vehicle.vehicle_make}
          model={vehicle.vehicle_model}
          year={vehicle.vehicle_year}
          animate={false}
          size="hero"
          label={summary.colorType}
          className={driveIn && !photoUrl ? "motion-vehicle-drive-in" : ""}
          dataEntrance={driveIn && !photoUrl}
        />
        {details}
      </div>
    );
  }

  return (
    <div
      className={["flex items-start gap-3", className].join(" ")}
      data-testid="vehicle-summary"
    >
      {details}
    </div>
  );
}
