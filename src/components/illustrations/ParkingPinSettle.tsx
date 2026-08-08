import { ILLUSTRATION } from "@/components/illustrations/palette";

type ParkingPinSettleProps = {
  className?: string;
  animate?: boolean;
};

/** Compact car on a road — used for “Waiting for a driver”. */
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
        d="M6 38h52"
        stroke={ILLUSTRATION.skyMid}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M12 42h40"
        stroke={ILLUSTRATION.navy}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.35"
      />
      <g className={animate ? "motion-pin-drop" : undefined}>
        <ellipse cx="32" cy="33" rx="14" ry="2.2" fill={ILLUSTRATION.navy} opacity="0.12" />
        <path
          d="M18 28c1.2-4.2 6.2-7 12.2-7h7.6c6.2 0 10.6 2.4 13.8 5.8l4.2 1.6c1 .3 1.7 1.2 1.7 2.2v1.8H17.2v-2.2c0-.9.6-1.7 1.5-2L18 28Z"
          fill={ILLUSTRATION.sky}
        />
        <path
          d="M28.5 21.2h9.2c3.8 0 6.8 1.8 8.8 4.2H26.8c.2-1.7.8-3.2 1.7-4.2Z"
          fill={ILLUSTRATION.surface}
        />
        <circle cx="25" cy="32.5" r="3.2" fill={ILLUSTRATION.navy} />
        <circle cx="43" cy="32.5" r="3.2" fill={ILLUSTRATION.navy} />
      </g>
    </svg>
  );
}
