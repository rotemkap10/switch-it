"use client";

import { useState, type ReactNode } from "react";

import { VehicleIllustration } from "@/components/vehicle/VehicleIllustration";
import { VehicleModelImage } from "@/components/vehicle/VehicleModelImage";
import type { VehicleColor } from "@/lib/vehicle/colors";
import { resolveCanonicalVehicleIdentity } from "@/lib/vehicle/catalog";
import type { VehicleType } from "@/lib/vehicle/types";

type VehicleImageProps = {
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
  photoUrl = null,
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
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(photoUrl) && !photoFailed;

  if (showPhoto && photoUrl) {
    return (
      <div
        className={[
          "vehicle-photo-frame",
          `vehicle-photo-frame--${size}`,
          className,
        ].join(" ")}
        data-testid="vehicle-photo"
        data-size={size}
      >
        {/* Signed or blob URLs; keep native img so expired/local previews work. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt={label || "Your vehicle"}
          className="vehicle-photo-frame__image"
          onError={() => setPhotoFailed(true)}
        />
      </div>
    );
  }

  const fallback = vehicleFallback({
    vehicleType,
    vehicleColor,
    placeholderPreview,
    size,
    label,
    className,
    animate,
    dataEntrance,
  });

  const identity = resolveCanonicalVehicleIdentity(make, model);

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
