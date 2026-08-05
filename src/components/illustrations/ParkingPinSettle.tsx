import { ILLUSTRATION } from "@/components/illustrations/palette";

type ParkingPinSettleProps = {
  className?: string;
  animate?: boolean;
};

/** Compact pin settling onto a road — used for “Waiting for a driver”. */
export function ParkingPinSettle({
  className = "h-12 w-16",
  animate = false,
}: ParkingPinSettleProps) {
  return (
    <svg
      viewBox="0 0 64 48"
      className={[className, animate ? "motion-pin-settle" : ""].join(" ")}
      aria-hidden="true"
      data-testid="parking-pin-settle"
      data-animated={animate ? "true" : "false"}
    >
      <path
        d="M4 38h56"
        stroke={ILLUSTRATION.skyMid}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M10 42h44"
        stroke={ILLUSTRATION.navy}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.35"
      />
      <g className={animate ? "motion-pin-drop" : undefined}>
        <path
          d="M32 6c-5.5 0-10 4.3-10 9.6 0 7.2 10 18.4 10 18.4s10-11.2 10-18.4C42 10.3 37.5 6 32 6Z"
          fill={ILLUSTRATION.sky}
          stroke={ILLUSTRATION.navy}
          strokeWidth="1.4"
        />
        <circle cx="32" cy="15" r="3.5" fill={ILLUSTRATION.surface} stroke={ILLUSTRATION.navy} strokeWidth="1.2" />
      </g>
    </svg>
  );
}
