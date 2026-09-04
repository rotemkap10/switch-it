import { ILLUSTRATION } from "@/components/illustrations/palette";

type HandoffEndedIconProps = {
  className?: string;
};

/** Calm ended-state mark — not a danger/error glyph. */
export function HandoffEndedIcon({ className = "h-10 w-10" }: HandoffEndedIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      aria-hidden="true"
      data-testid="handoff-ended-icon"
    >
      <circle cx="10" cy="10" r="9" fill={ILLUSTRATION.coralSoft} />
      <path
        d="M6 10h8"
        fill="none"
        stroke={ILLUSTRATION.coral}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
