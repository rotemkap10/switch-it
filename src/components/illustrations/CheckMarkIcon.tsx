import { ILLUSTRATION } from "@/components/illustrations/palette";

type CheckMarkIconProps = {
  className?: string;
  animated?: boolean;
};

export function CheckMarkIcon({
  className = "h-4 w-4",
  animated = false,
}: CheckMarkIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={[className, animated ? "motion-check-pop" : ""].join(" ")}
      aria-hidden="true"
      data-testid="check-mark-icon"
      data-animated={animated ? "true" : "false"}
    >
      <circle cx="10" cy="10" r="9" fill={ILLUSTRATION.successSoft} />
      <path
        d="M5.5 10.2 8.6 13.2 14.5 6.8"
        fill="none"
        stroke={ILLUSTRATION.success}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={animated ? "motion-check-draw" : undefined}
      />
    </svg>
  );
}
