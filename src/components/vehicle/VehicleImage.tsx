"use client";

import { useState } from "react";

import { VehicleIllustration } from "@/components/vehicle/VehicleIllustration";
import type { VehicleColor } from "@/lib/vehicle/colors";
import type { VehicleType } from "@/lib/vehicle/types";

type VehicleImageProps = {
  photoUrl?: string | null;
  vehicleType?: VehicleType | null;
  vehicleColor?: VehicleColor | null;
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
