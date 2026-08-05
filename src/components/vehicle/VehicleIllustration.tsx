import type { VehicleColor } from "@/lib/vehicle/colors";
import {
  resolveVehicleIllustration,
  silhouetteForType,
  vehiclePalette,
  VehicleWheels,
} from "@/lib/vehicle/illustration-silhouettes";
import type { VehicleType } from "@/lib/vehicle/types";

type VehicleIllustrationProps = {
  vehicleType: VehicleType;
  vehicleColor: VehicleColor;
  /**
   * Optional future key for approved model-specific assets.
   * Not stored in the database in this phase; generic silhouettes are always used.
   */
  illustrationKey?: string | null;
  /** Accessible label; decorative by default. */
  label?: string;
  className?: string;
  animate?: boolean;
  size?: "default" | "compact";
};

const SIZE_CLASSES = {
  default: "max-w-full [&_svg]:h-auto [&_svg]:w-[10rem]",
  compact: "max-w-full [&_svg]:h-auto [&_svg]:w-[4.5rem]",
} as const;

export function VehicleIllustration({
  vehicleType,
  vehicleColor,
  illustrationKey = null,
  label,
  className = "",
  animate = true,
  size = "default",
}: VehicleIllustrationProps) {
  const resolvedType = resolveVehicleIllustration(vehicleType, illustrationKey);
  const palette = vehiclePalette(vehicleColor);

  return (
    <div
      className={[
        "flex items-center justify-center rounded-[var(--radius-card)] bg-accent-soft/70 p-2",
        SIZE_CLASSES[size],
        animate ? "motion-soft-scale-in" : "",
        className,
      ].join(" ")}
      data-testid="vehicle-illustration"
      data-vehicle-type={resolvedType}
      data-vehicle-color={vehicleColor}
      data-silhouette={resolvedType}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg
        viewBox="0 0 112 80"
        width={size === "compact" ? 72 : 160}
        height={size === "compact" ? 52 : 114}
        className="block"
        xmlns="http://www.w3.org/2000/svg"
      >
        {silhouetteForType(resolvedType, palette)}
        <VehicleWheels />
      </svg>
    </div>
  );
}
