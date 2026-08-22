import type { VehicleColor } from "@/lib/vehicle/colors";
import {
  resolveVehicleIllustration,
  silhouetteForType,
  vehiclePalette,
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
  /**
   * `hero` — full-width profile showcase (not a side icon).
   * `default` — standard card preview.
   * `handoff` — floating identity image during an active handoff.
   * `compact` — inline / animation thumbnail only.
   */
  size?: "default" | "compact" | "handoff" | "hero";
  /** Marks one-shot entrance for tests / analytics-free contracts. */
  dataEntrance?: boolean;
};

const SIZE_CLASSES = {
  default: "max-w-full bg-accent-soft p-2 [&_svg]:h-auto [&_svg]:w-[11rem]",
  compact:
    "max-w-full bg-accent-soft p-1.5 [&_svg]:h-auto [&_svg]:w-[6.25rem]",
  handoff: [
    "w-[12.5rem] max-w-full bg-transparent p-0 sm:w-[14.5rem]",
    "[&_svg]:h-auto [&_svg]:w-full",
  ].join(" "),
  hero: [
    "w-full bg-accent-soft",
    "px-4 py-[clamp(0.75rem,2.5dvh,1.5rem)] sm:px-8 sm:py-8",
    "[&_svg]:h-auto [&_svg]:w-[min(100%,clamp(12rem,44vw,15.5rem))] sm:[&_svg]:w-[min(100%,21rem)]",
  ].join(" "),
} as const;

export function VehicleIllustration({
  vehicleType,
  vehicleColor,
  illustrationKey = null,
  label,
  className = "",
  animate = true,
  size = "default",
  dataEntrance = false,
}: VehicleIllustrationProps) {
  const resolvedType = resolveVehicleIllustration(vehicleType, illustrationKey);
  const palette = vehiclePalette(vehicleColor);

  return (
    <div
      className={[
        "flex items-center justify-center",
        size === "handoff" ? "" : "rounded-[var(--radius-card)]",
        SIZE_CLASSES[size],
        animate ? "motion-soft-scale-in" : "",
        className,
      ].join(" ")}
      data-testid="vehicle-illustration"
      data-vehicle-type={resolvedType}
      data-vehicle-color={vehicleColor}
      data-silhouette={resolvedType}
      data-size={size}
      data-entrance={dataEntrance ? "true" : "false"}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg
        viewBox="0 0 140 88"
        className="block max-h-none"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        overflow="visible"
      >
        {silhouetteForType(resolvedType, palette)}
      </svg>
    </div>
  );
}
