import type { VehicleColor } from "@/lib/vehicle/colors";
import { VEHICLE_COLOR_FILL } from "@/lib/vehicle/colors";
import type { VehicleType } from "@/lib/vehicle/types";

type VehicleIllustrationProps = {
  vehicleType: VehicleType;
  vehicleColor: VehicleColor;
  /** Accessible label; decorative by default. */
  label?: string;
  className?: string;
  animate?: boolean;
};

function outlineFor(fill: string): string {
  // Keep light cars readable on white/sky UI.
  if (fill === "#f7fbff" || fill === "#c5d0db" || fill === "#d8c3a5") {
    return "#4b687d";
  }
  return "#12324a";
}

function MiniBody({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <>
      <path
        d="M22 46h68c4 0 8 3 9 7l4 14H10l3-12c1-5 5-9 9-9Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
      />
      <path
        d="M30 46c3-10 10-16 22-16h12c10 0 16 5 20 16"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
      />
    </>
  );
}

function HatchbackBody({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <>
      <path
        d="M14 50h78c5 0 9 4 10 9l3 13H8l2-11c1-6 5-11 10-11Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
      />
      <path
        d="M28 50c4-14 14-22 30-22h8c14 0 22 7 28 22"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
      />
    </>
  );
}

function SedanBody({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <>
      <path
        d="M8 52h92c4 0 8 3 9 7l3 13H5l2-11c1-5 4-9 8-9Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
      />
      <path
        d="M30 52c5-13 14-20 28-20h10c12 0 20 6 26 20"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
      />
      <path
        d="M78 52h18c2 0 3 1 3 3v5H78V52Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
      />
    </>
  );
}

function SuvBody({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <>
      <path
        d="M10 44h84c5 0 9 4 10 9l2 15H8l1-13c1-6 4-11 9-11Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
      />
      <path
        d="M24 44c3-12 12-20 28-20h16c14 0 22 7 28 20"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
      />
    </>
  );
}

function PickupBody({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <>
      <path
        d="M8 48h50c4 0 7 3 8 7l2 13H6l1-12c1-5 4-8 8-8Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
      />
      <path
        d="M22 48c3-11 10-17 22-17h6c9 0 14 5 18 17"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
      />
      <path
        d="M58 52h40c2 0 4 2 4 4v12H58V52Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
      />
    </>
  );
}

function VanBody({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <>
      <path
        d="M12 34h78c5 0 9 4 10 9v25H10V43c0-5 3-9 8-9Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
      />
      <path
        d="M70 34c4 0 8 2 10 6"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
      />
    </>
  );
}

function OtherBody({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <>
      <path
        d="M16 48h74c4 0 8 3 9 7l3 13H12l2-12c1-5 4-8 8-8Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
      />
      <circle cx="55" cy="40" r="10" fill={fill} stroke={stroke} strokeWidth="2.5" />
    </>
  );
}

function bodyForType(
  type: VehicleType,
  fill: string,
  stroke: string,
) {
  switch (type) {
    case "mini":
      return <MiniBody fill={fill} stroke={stroke} />;
    case "hatchback":
      return <HatchbackBody fill={fill} stroke={stroke} />;
    case "sedan":
      return <SedanBody fill={fill} stroke={stroke} />;
    case "suv":
      return <SuvBody fill={fill} stroke={stroke} />;
    case "pickup":
      return <PickupBody fill={fill} stroke={stroke} />;
    case "van":
      return <VanBody fill={fill} stroke={stroke} />;
    default:
      return <OtherBody fill={fill} stroke={stroke} />;
  }
}

export function VehicleIllustration({
  vehicleType,
  vehicleColor,
  label,
  className = "",
  animate = true,
}: VehicleIllustrationProps) {
  const fill = VEHICLE_COLOR_FILL[vehicleColor];
  const stroke = outlineFor(fill);

  return (
    <div
      className={[
        "flex items-center justify-center rounded-[var(--radius-card)] bg-accent-soft/70 p-3",
        animate ? "motion-soft-scale-in" : "",
        className,
      ].join(" ")}
      data-testid="vehicle-illustration"
      data-vehicle-type={vehicleType}
      data-vehicle-color={vehicleColor}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg
        viewBox="0 0 112 80"
        width="160"
        height="114"
        className="max-w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {bodyForType(vehicleType, fill, stroke)}
        <circle cx="32" cy="68" r="8" fill="#12324a" />
        <circle cx="32" cy="68" r="3.5" fill="#eaf8ff" />
        <circle cx="82" cy="68" r="8" fill="#12324a" />
        <circle cx="82" cy="68" r="3.5" fill="#eaf8ff" />
      </svg>
    </div>
  );
}
