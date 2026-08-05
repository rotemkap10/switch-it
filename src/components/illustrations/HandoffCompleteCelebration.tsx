import { CheckMarkIcon } from "@/components/illustrations/CheckMarkIcon";
import { CoinIcon } from "@/components/illustrations/CoinIcon";
import { ILLUSTRATION } from "@/components/illustrations/palette";

type HandoffCompleteCelebrationProps = {
  animate?: boolean;
};

/**
 * Decorative one-shot celebration after handoff success.
 * Does not replace the toast / credit transfer — visual only.
 */
export function HandoffCompleteCelebration({
  animate = true,
}: HandoffCompleteCelebrationProps) {
  return (
    <div
      className={[
        "flex flex-col items-center gap-2 py-1",
        animate ? "motion-handoff-celebrate" : "",
      ].join(" ")}
      data-testid="handoff-complete-celebration"
      aria-hidden="true"
    >
      <div className="relative flex h-14 w-full max-w-[14rem] items-end justify-between px-2">
        <MiniCar facing="right" className={animate ? "motion-celebrate-car-left" : ""} />
        <span className={animate ? "motion-celebrate-coin" : ""}>
          <CoinIcon className="h-6 w-6" />
        </span>
        <MiniCar facing="left" className={animate ? "motion-celebrate-car-right" : ""} />
      </div>
      <CheckMarkIcon className="h-5 w-5" animated={animate} />
    </div>
  );
}

function MiniCar({
  facing,
  className = "",
}: {
  facing: "left" | "right";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 40 24"
      className={["h-8 w-12", className].join(" ")}
      style={{ transform: facing === "left" ? "scaleX(-1)" : undefined }}
    >
      <path
        d="M6 16h28l-2-6c-1-3-3.5-5-7-5h-8c-3 0-5 2-6 5L6 16Z"
        fill={ILLUSTRATION.sky}
        stroke={ILLUSTRATION.navy}
        strokeWidth="1.2"
      />
      <rect x="14" y="8" width="10" height="4" rx="1" fill={ILLUSTRATION.skySoft} />
      <circle cx="12" cy="17" r="2.5" fill={ILLUSTRATION.navy} />
      <circle cx="28" cy="17" r="2.5" fill={ILLUSTRATION.navy} />
    </svg>
  );
}
