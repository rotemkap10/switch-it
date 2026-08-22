import { PORCELAIN, SIGNAL_BLUE } from "@/lib/branding/colors";
import type { VehicleColor } from "@/lib/vehicle/colors";
import type { VehicleType } from "@/lib/vehicle/types";

export type VehicleSilhouetteProps = {
  fill: string;
  stroke: string;
  windowFill: string;
  highlight: string;
  shade: string;
  bumper: string;
  tire: string;
  rim: string;
  headlight: string;
  taillight: string;
};

export function outlineForVehicleFill(_fill = ""): string {
  void _fill;
  return SIGNAL_BLUE;
}

export function windowFillForVehicleFill(_fill = ""): string {
  void _fill;
  return PORCELAIN;
}

/** Shared wheel with rim detail — positions vary by body type. */
export function VehicleWheel({
  cx,
  cy = 74,
  radius = 9,
}: {
  cx: number;
  cy?: number;
  radius?: number;
}) {
  const rimR = radius * 0.58;
  const hubR = radius * 0.22;
  return (
    <g data-part="wheel">
      <circle cx={cx} cy={cy} r={radius} fill={SIGNAL_BLUE} />
      <circle cx={cx} cy={cy} r={rimR} fill={PORCELAIN} />
      <circle cx={cx} cy={cy} r={hubR} fill={SIGNAL_BLUE} />
    </g>
  );
}

/** @deprecated Prefer per-silhouette wheels; kept for outline helper tests. */
export function VehicleWheels() {
  return (
    <>
      <VehicleWheel cx={36} />
      <VehicleWheel cx={104} />
    </>
  );
}

function GroundShadow(_props: { cx?: number; rx?: number }) {
  void _props;
  return null;
}

/** Mini: short wheelbase, tall rounded cabin. */
export function MiniSilhouette(props: VehicleSilhouetteProps) {
  const { fill, stroke, windowFill, highlight, shade, bumper, headlight, taillight } =
    props;
  return (
    <>
      <GroundShadow cx={70} rx={40} />
      <path
        d="M28 58c2-14 12-22 28-23h12c14 1 22 8 26 23l3 14H26l2-14Z"
        fill={shade}

        data-part="shade"
      />
      <path
        d="M26 56c3-16 14-24 32-25h14c15 1 24 9 28 25l2 16H24l2-16Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
        data-part="body"
      />
      <path
        d="M38 38c4-8 12-12 24-12h8c10 0 17 4 21 12"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
        data-part="cabin"
      />
      <path
        d="M42 40h34c3 0 5 2 6 5l2 9H38l2-9c1-3 2-5 4-5Z"
        fill={windowFill}
        stroke={stroke}
        strokeWidth="1.4"
        data-part="window"
      />
      <path
        d="M44 41.5h14"
        stroke={highlight}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect
        x="24"
        y="68"
        width="92"
        height="4"
        rx="1.5"
        fill={bumper}

        data-part="bumper"
      />
      <ellipse cx="30" cy="62" rx="3.2" ry="2.4" fill={headlight} data-part="headlight" />
      <ellipse cx="110" cy="62" rx="2.6" ry="2.2" fill={taillight} data-part="taillight" />
      <VehicleWheel cx={44} radius={8.5} />
      <VehicleWheel cx={96} radius={8.5} />
    </>
  );
}

/** Hatchback: compact cabin, steep rear hatch, short overhang. */
export function HatchbackSilhouette(props: VehicleSilhouetteProps) {
  const { fill, stroke, windowFill, highlight, shade, bumper, headlight, taillight } =
    props;
  return (
    <>
      <GroundShadow cx={70} rx={48} />
      <path
        d="M16 60c2-8 8-14 18-15h72c8 1 14 6 16 14l2 15H14l2-14Z"
        fill={shade}

      />
      <path
        d="M14 58c3-10 10-16 22-17h68c10 1 18 7 20 17l2 16H12l2-16Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
        data-part="body"
      />
      <path
        d="M34 41c4-12 16-18 32-18h14c14 1 24 7 30 18"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
        data-part="cabin"
      />
      <path
        d="M40 42h40l14 16H34l6-12c1-2 3-4 6-4Z"
        fill={windowFill}
        stroke={stroke}
        strokeWidth="1.4"
        data-part="window"
      />
      <path
        d="M92 44l14 14"
        stroke={stroke}
        strokeWidth="1.3"

        data-part="hatch"
      />
      <path
        d="M42 43.5h18"
        stroke={highlight}
        strokeWidth="1.5"
        strokeLinecap="round"

      />
      <rect x="12" y="70" width="116" height="4" rx="1.5" fill={bumper} />
      <ellipse cx="20" cy="64" rx="3.4" ry="2.5" fill={headlight} />
      <ellipse cx="120" cy="64" rx="2.8" ry="2.3" fill={taillight} />
      <VehicleWheel cx={40} />
      <VehicleWheel cx={102} />
    </>
  );
}

/** Sedan: three-box profile with clear trunk and lower stance. */
export function SedanSilhouette(props: VehicleSilhouetteProps) {
  const { fill, stroke, windowFill, highlight, shade, bumper, headlight, taillight } =
    props;
  return (
    <>
      <GroundShadow cx={70} rx={56} />
      <path
        d="M8 62c2-8 8-12 18-13h96c8 1 14 5 16 13l2 13H6l2-13Z"
        fill={shade}

      />
      <path
        d="M6 60c3-9 10-14 22-15h94c10 1 16 6 18 15l2 14H4l2-14Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
        data-part="body"
      />
      <path
        d="M34 45c5-13 18-20 36-20h14c14 0 24 6 30 20"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
        data-part="cabin"
      />
      <path
        d="M96 58h28c3 0 5 2 5 4v8H96V58Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        data-part="trunk"
      />
      <path
        d="M40 46h42c2 0 4 1 5 3l3 9H36l3-9c1-2 2-3 4-3Z"
        fill={windowFill}
        stroke={stroke}
        strokeWidth="1.4"
        data-part="window"
      />
      <path
        d="M62 46v12"
        stroke={stroke}
        strokeWidth="1.2"

        data-part="pillar"
      />
      <path
        d="M42 47.5h16"
        stroke={highlight}
        strokeWidth="1.5"
        strokeLinecap="round"

      />
      <rect x="4" y="71" width="132" height="3.5" rx="1.5" fill={bumper} />
      <ellipse cx="14" cy="65" rx="3.6" ry="2.4" fill={headlight} />
      <ellipse cx="126" cy="65" rx="3" ry="2.3" fill={taillight} />
      <VehicleWheel cx={36} />
      <VehicleWheel cx={108} />
    </>
  );
}

/** SUV: taller cabin, larger arches, higher ride. */
export function SuvSilhouette(props: VehicleSilhouetteProps) {
  const { fill, stroke, windowFill, highlight, shade, bumper, headlight, taillight } =
    props;
  return (
    <>
      <GroundShadow cx={70} rx={54} />
      <path
        d="M10 52c2-8 8-12 18-13h92c9 1 15 5 17 13l1 20H9l1-20Z"
        fill={shade}

      />
      <path
        d="M8 50c3-10 10-14 22-15h90c11 1 18 6 20 15l1 22H7l1-22Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
        data-part="body"
      />
      <path
        d="M26 35c3-14 16-22 36-22h18c18 0 28 8 34 22"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
        data-part="cabin"
      />
      <path
        d="M34 36h58c3 0 5 2 5 5v12H30V41c0-3 2-5 4-5Z"
        fill={windowFill}
        stroke={stroke}
        strokeWidth="1.4"
        data-part="window"
      />
      <path
        d="M52 36v17M74 36v17"
        stroke={stroke}
        strokeWidth="1.15"

      />
      <path
        d="M36 37.5h20"
        stroke={highlight}
        strokeWidth="1.6"
        strokeLinecap="round"

      />
      <path
        d="M18 58c0-4 3-7 7-7h8c4 0 7 3 7 7"
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"

        data-part="arch"
      />
      <path
        d="M100 58c0-4 3-7 7-7h8c4 0 7 3 7 7"
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"

      />
      <rect x="7" y="69" width="126" height="4" rx="1.5" fill={bumper} />
      <ellipse cx="16" cy="60" rx="3.5" ry="2.6" fill={headlight} />
      <ellipse cx="124" cy="60" rx="3" ry="2.4" fill={taillight} />
      <VehicleWheel cx={38} radius={10} />
      <VehicleWheel cx={106} radius={10} />
    </>
  );
}

/** Pickup: cab + open rear bed. */
export function PickupSilhouette(props: VehicleSilhouetteProps) {
  const { fill, stroke, windowFill, highlight, shade, bumper, headlight, taillight } =
    props;
  return (
    <>
      <GroundShadow cx={72} rx={54} />
      <path
        d="M8 56c2-8 8-12 16-13h42c7 1 12 5 14 13l1 16H7l1-16Z"
        fill={shade}

      />
      <path
        d="M6 54c3-9 9-13 18-14h42c8 1 14 5 16 14l1 18H5l1-18Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
        data-part="cab"
      />
      <path
        d="M28 40c3-10 10-15 22-15h6c9 0 15 5 18 15"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
        data-part="cabin"
      />
      <path
        d="M66 56h60c3 0 5 2 5 5v13H66V56Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
        data-part="bed"
      />
      <path
        d="M70 58h50v4H70V58Z"
        fill={shade}

        data-part="bed-rail"
      />
      <path
        d="M32 42h20c2 0 3 1 3 3v8H30v-8c0-2 1-3 2-3Z"
        fill={windowFill}
        stroke={stroke}
        strokeWidth="1.4"
        data-part="window"
      />
      <path
        d="M34 43.5h10"
        stroke={highlight}
        strokeWidth="1.4"
        strokeLinecap="round"

      />
      <rect x="5" y="70" width="126" height="3.5" rx="1.5" fill={bumper} />
      <ellipse cx="14" cy="62" rx="3.2" ry="2.4" fill={headlight} />
      <ellipse cx="124" cy="64" rx="2.6" ry="2.2" fill={taillight} />
      <VehicleWheel cx={34} />
      <VehicleWheel cx={104} />
    </>
  );
}

/** Van: tall rectangular cabin, short nose. */
export function VanSilhouette(props: VehicleSilhouetteProps) {
  const { fill, stroke, windowFill, highlight, shade, bumper, headlight, taillight } =
    props;
  return (
    <>
      <GroundShadow cx={70} rx={52} />
      <path
        d="M14 34c2-4 6-6 12-6h90c6 0 12 3 14 8v36H12V40c0-4 1-6 2-6Z"
        fill={shade}

      />
      <path
        d="M12 32c3-5 8-7 14-7h88c8 0 14 4 16 10v37H10V40c0-5 1-8 2-8Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
        data-part="body"
      />
      <path
        d="M30 36h52v22H30V36Z"
        fill={windowFill}
        stroke={stroke}
        strokeWidth="1.4"
        data-part="window"
      />
      <path
        d="M86 36h22v22H86V36Z"
        fill={windowFill}
        stroke={stroke}
        strokeWidth="1.4"

        data-part="window-rear"
      />
      <path
        d="M32 38h18"
        stroke={highlight}
        strokeWidth="1.5"
        strokeLinecap="round"

      />
      <path
        d="M18 48h8v10h-8V48Z"
        fill={windowFill}
        stroke={stroke}
        strokeWidth="1.2"

        data-part="window-front"
      />
      <rect x="10" y="70" width="120" height="3.5" rx="1.5" fill={bumper} />
      <ellipse cx="18" cy="58" rx="3.2" ry="2.5" fill={headlight} />
      <ellipse cx="122" cy="58" rx="2.8" ry="2.3" fill={taillight} />
      <VehicleWheel cx={40} />
      <VehicleWheel cx={104} />
    </>
  );
}

/** Other: neutral rounded profile with cabin marker (safe fallback). */
export function OtherSilhouette(props: VehicleSilhouetteProps) {
  const { fill, stroke, windowFill, highlight, shade, bumper, headlight, taillight } =
    props;
  return (
    <>
      <GroundShadow cx={70} rx={48} />
      <path
        d="M18 58c3-10 10-15 22-16h70c10 1 16 6 18 16l2 14H16l2-14Z"
        fill={shade}

      />
      <path
        d="M16 56c3-11 12-17 24-18h70c12 1 20 7 22 18l2 16H14l2-16Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
        data-part="body"
      />
      <circle
        cx="70"
        cy="44"
        r="12"
        fill={windowFill}
        stroke={stroke}
        strokeWidth="2"
        data-part="marker"
      />
      <circle cx={70} cy={44} r={5} fill={highlight} />
      <rect x="14" y="70" width="112" height="3.5" rx="1.5" fill={bumper} />
      <ellipse cx="22" cy="63" rx="3" ry="2.3" fill={headlight} />
      <ellipse cx="118" cy="63" rx="2.6" ry="2.2" fill={taillight} />
      <VehicleWheel cx={40} />
      <VehicleWheel cx={102} />
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

export function vehiclePalette(color: VehicleColor): VehicleSilhouetteProps {
  void color;
  return {
    fill: SIGNAL_BLUE,
    stroke: SIGNAL_BLUE,
    windowFill: PORCELAIN,
    highlight: PORCELAIN,
    shade: PORCELAIN,
    bumper: SIGNAL_BLUE,
    tire: SIGNAL_BLUE,
    rim: PORCELAIN,
    headlight: PORCELAIN,
    taillight: SIGNAL_BLUE,
  };
}
