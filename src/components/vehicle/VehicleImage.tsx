"use client";

import { type ReactNode } from "react";

import { VehicleIllustration } from "@/components/vehicle/VehicleIllustration";
import { VehicleModelImage } from "@/components/vehicle/VehicleModelImage";
import { getVehicleClass, resolveCanonicalVehicleIdentity } from "@/lib/vehicle/catalog";
import type { VehicleColor } from "@/lib/vehicle/colors";
import type { VehicleType } from "@/lib/vehicle/types";

type VehicleImageProps = {
  /** Uploaded photos are no longer shown. Kept so legacy callers can pass it. */
  photoUrl?: string | null;
  vehicleType?: VehicleType | null;
  vehicleColor?: VehicleColor | null;
  make?: string | null;
  model?: string | null;
  year?: string | number | null;
  placeholderPreview?: boolean;
  size?: "default" | "compact" | "hero";
  label?: string;
  className?: string;
  animate?: boolean;
  dataEntrance?: boolean;
};

export function VehicleImage({
  vehicleType = null,
  vehicleColor = null,
  make = null,
  model = null,
  year = null,
  placeholderPreview = false,
  size = "default",
  label,
  className = "",
  animate = false,
  dataEntrance = false,
}: VehicleImageProps) {
  const identity = resolveCanonicalVehicleIdentity(make, model);
  const derivedType = getVehicleClass(identity.make, identity.model, vehicleType);

  const fallback = vehicleFallback({
    vehicleType: derivedType,
    vehicleColor,
    placeholderPreview,
    size,
    label,
    className,
    animate,
    dataEntrance,
  });

  return (
    <VehicleModelImage
      make={identity.make}
      model={identity.model}
      year={year}
      alt={label || "Vehicle"}
      className={className}
      size={size}
    >
      {fallback}
    </VehicleModelImage>
  );
}

function vehicleFallback({
  vehicleType,
  vehicleColor,
  placeholderPreview,
  size,
  label,
  className,
  animate,
  dataEntrance,
}: {
  vehicleType?: VehicleType | null;
  vehicleColor?: VehicleColor | null;
  placeholderPreview: boolean;
  size: "default" | "compact" | "hero";
  label?: string;
  className: string;
  animate: boolean;
  dataEntrance: boolean;
}): ReactNode {
  if (vehicleType && vehicleColor) {
    return (
      <VehicleIllustration
        vehicleType={vehicleType}
        vehicleColor={vehicleColor}
        size={size}
        animate={animate}
        label={label}
        className={className}
        dataEntrance={dataEntrance}
      />
    );
  }

  if (placeholderPreview) {
    return (
      <div data-testid="vehicle-illustration-placeholder">
        <VehicleIllustration
          vehicleType="sedan"
          vehicleColor="silver"
          size={size}
          animate={false}
          label={label ?? "Vehicle preview"}
          className={["opacity-80", className].filter(Boolean).join(" ")}
        />
      </div>
    );
  }

  return null;
}
