import type { VehicleColor } from "@/lib/vehicle/colors";
import { VEHICLE_COLOR_FILL } from "@/lib/vehicle/colors";
import type { VehicleType } from "@/lib/vehicle/types";

export type VehicleSilhouetteProps = {
  fill: string;
  stroke: string;
  windowFill: string;
};

export function outlineForVehicleFill(fill: string): string {
  if (fill === "#f7fbff" || fill === "#c5d0db" || fill === "#d8c3a5") {
    return "#4b687d";
  }
  return "#12324a";
}

export function windowFillForVehicleFill(fill: string): string {
  if (fill === "#f7fbff" || fill === "#c5d0db" || fill === "#d8c3a5") {
    return "#d9ecfb";
  }
  return "#eaf8ff";
}

export function VehicleWheels() {
  return (
    <>
      <circle cx="30" cy="68" r="8" fill="#12324a" />
      <circle cx="30" cy="68" r="3.5" fill="#eaf8ff" />
      <circle cx="84" cy="68" r="8" fill="#12324a" />
      <circle cx="84" cy="68" r="3.5" fill="#eaf8ff" />
    </>
  );
}

/** Mini: short wheelbase, rounded bubble roof. */
export function MiniSilhouette({ fill, stroke, windowFill }: VehicleSilhouetteProps) {
  return (
    <>
      <path
        d="M24 50h64c3 0 6 2 7 6l3 12H18l2-10c1-4 4-8 8-8Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
        data-part="body"
      />
      <path
        d="M34 50c2-8 8-14 18-15h8c8 1 13 6 16 15"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
        data-part="cabin"
      />
      <path
        d="M40 38h24c2 0 4 2 4 4v6H36v-6c0-2 2-4 4-4Z"
        fill={windowFill}
        stroke={stroke}
        strokeWidth="1.5"
        data-part="window"
      />
    </>
  );
}

/** Hatchback: steep rear hatch, compact cabin. */
export function HatchbackSilhouette({
  fill,
  stroke,
  windowFill,
}: VehicleSilhouetteProps) {
  return (
    <>
      <path
        d="M14 52h84c4 0 8 3 9 8l3 12H8l2-10c1-5 4-9 9-9Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
        data-part="body"
      />
      <path
        d="M28 52c3-12 12-20 28-21h10c12 1 19 7 24 21"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
        data-part="cabin"
      />
      <path
        d="M34 34h36l10 18H30l4-14c1-3 3-4 6-4Z"
        fill={windowFill}
        stroke={stroke}
        strokeWidth="1.5"
        data-part="window"
      />
    </>
  );
}

/** Sedan: long three-box profile with distinct trunk. */
export function SedanSilhouette({ fill, stroke, windowFill }: VehicleSilhouetteProps) {
  return (
    <>
      <path
        d="M6 54h100c3 0 6 2 7 6l3 12H4l2-10c1-4 3-8 7-8Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
        data-part="body"
      />
      <path
        d="M28 54c4-12 14-19 30-19h12c11 0 18 5 23 19"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
        data-part="cabin"
      />
      <path
        d="M78 54h20c2 0 4 2 4 4v6H78V54Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
        data-part="trunk"
      />
      <path
        d="M34 36h40c2 0 4 2 4 4v8H30v-8c0-2 2-4 4-4Z"
        fill={windowFill}
        stroke={stroke}
        strokeWidth="1.5"
        data-part="window"
      />
    </>
  );
}

/** SUV: tall boxy cabin, higher ride height. */
export function SuvSilhouette({ fill, stroke, windowFill }: VehicleSilhouetteProps) {
  return (
    <>
      <path
        d="M10 46h92c4 0 8 3 9 7l2 15H8l1-14c1-5 3-9 8-9Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
        data-part="body"
      />
      <path
        d="M22 46c2-14 14-22 32-22h16c15 0 24 7 30 22"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
        data-part="cabin"
      />
      <path
        d="M30 28h52c3 0 5 2 5 5v13H26V33c0-3 2-5 4-5Z"
        fill={windowFill}
        stroke={stroke}
        strokeWidth="1.5"
        data-part="window"
      />
    </>
  );
}

/** Pickup: separated cab and open bed. */
export function PickupSilhouette({ fill, stroke, windowFill }: VehicleSilhouetteProps) {
  return (
    <>
      <path
        d="M8 50h48c3 0 6 2 7 6l2 14H6l1-11c1-4 3-7 7-7Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
        data-part="cab"
      />
      <path
        d="M22 50c2-10 9-16 20-16h4c8 0 13 5 17 16"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
        data-part="cabin"
      />
      <path
        d="M58 52h42c2 0 4 2 4 4v10H58V52Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
        data-part="bed"
      />
      <path
        d="M26 34h18c2 0 3 1 3 3v7H24v-7c0-2 1-3 3-3Z"
        fill={windowFill}
        stroke={stroke}
        strokeWidth="1.5"
        data-part="window"
      />
    </>
  );
}

/** Van: tall rectangular body, minimal slope. */
export function VanSilhouette({ fill, stroke, windowFill }: VehicleSilhouetteProps) {
  return (
    <>
      <path
        d="M12 32h88c4 0 8 3 9 7v27H10V39c0-4 2-7 6-7Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
        data-part="body"
      />
      <path
        d="M24 36h48v18H24V36Z"
        fill={windowFill}
        stroke={stroke}
        strokeWidth="1.5"
        data-part="window"
      />
      <path
        d="M72 36h16v18H72V36Z"
        fill={windowFill}
        stroke={stroke}
        strokeWidth="1.5"
        data-part="window-rear"
      />
    </>
  );
}

/** Other: neutral profile with rounded cabin marker. */
export function OtherSilhouette({ fill, stroke, windowFill }: VehicleSilhouetteProps) {
  return (
    <>
      <path
        d="M16 50h80c3 0 7 2 8 6l3 14H14l2-11c1-4 3-7 7-7Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
        data-part="body"
      />
      <circle
        cx="56"
        cy="40"
        r="11"
        fill={windowFill}
        stroke={stroke}
        strokeWidth="2"
        data-part="marker"
      />
    </>
  );
}

export function silhouetteForType(
  type: VehicleType,
  props: VehicleSilhouetteProps,
) {
  switch (type) {
    case "mini":
      return <MiniSilhouette {...props} />;
    case "hatchback":
      return <HatchbackSilhouette {...props} />;
    case "sedan":
      return <SedanSilhouette {...props} />;
    case "suv":
      return <SuvSilhouette {...props} />;
    case "pickup":
      return <PickupSilhouette {...props} />;
    case "van":
      return <VanSilhouette {...props} />;
    default:
      return <OtherSilhouette {...props} />;
  }
}

/**
 * Future extension: optional illustrationKey can map to approved local/CDN assets.
 * When absent or unknown, callers always receive the generic type silhouette above.
 */
export function resolveVehicleIllustration(
  vehicleType: VehicleType,
  illustrationKey?: string | null,
): VehicleType {
  void illustrationKey;
  return vehicleType;
}

export function vehiclePalette(color: VehicleColor) {
  const fill = VEHICLE_COLOR_FILL[color];
  return {
    fill,
    stroke: outlineForVehicleFill(fill),
    windowFill: windowFillForVehicleFill(fill),
  };
}
