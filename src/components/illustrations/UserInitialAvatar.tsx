import { ILLUSTRATION } from "@/components/illustrations/palette";

type UserInitialAvatarProps = {
  name: string | null | undefined;
  className?: string;
  /** Play one-time entrance when true. */
  animateEntrance?: boolean;
  size?: "sm" | "md";
};

export function displayNameInitial(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) {
    return "?";
  }
  return trimmed.charAt(0).toUpperCase();
}

export function UserInitialAvatar({
  name,
  className = "",
  animateEntrance = false,
  size = "sm",
}: UserInitialAvatarProps) {
  const initial = displayNameInitial(name);
  const label = name?.trim() ? `Avatar for ${name.trim()}` : "User avatar";
  const sizeClass = size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";

  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-full",
        "border border-border bg-accent-soft font-semibold text-accent-hover",
        sizeClass,
        animateEntrance ? "motion-avatar-pop" : "",
        className,
      ].join(" ")}
      role="img"
      aria-label={label}
      data-testid="user-initial-avatar"
      data-initial={initial}
    >
      {initial}
    </span>
  );
}

/** Decorative mail mark for the email summary card. */
export function EmailMarkIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect
        x="3.5"
        y="6"
        width="17"
        height="12"
        rx="2.5"
        fill={ILLUSTRATION.skySoft}
        stroke={ILLUSTRATION.navy}
        strokeWidth="1.4"
      />
      <path
        d="M4.5 7.5 12 13l7.5-5.5"
        fill="none"
        stroke={ILLUSTRATION.sky}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
